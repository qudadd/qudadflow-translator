/* Upstream discovery: settings drafts or the saved active API on reading pages. */
const QFModelCatalog = (() => {
  const LIMIT = 1000;
  const fail = (message, code) => Object.assign(new Error(message), { code });

  function endpoint(raw) {
    let url;
    try { url = new URL(String(raw || '').trim()); } catch { throw fail('请输入有效的 API 端点。', 'INVALID_ENDPOINT'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
      throw fail('API 端点须为 HTTP(S) 地址，且不能包含用户名或密码。', 'INVALID_ENDPOINT');
    }
    url.hash = '';
    let pathname = url.pathname.replace(/\/+$/, '');
    if (/\/(chat\/completions|responses)$/.test(pathname)) pathname = pathname.replace(/\/(chat\/completions|responses)$/, '/models');
    else if (!pathname.endsWith('/models')) pathname += pathname.endsWith('/v1') ? '/models' : '/v1/models';
    url.pathname = pathname;
    return url;
  }

  function secretsFor(values, headers = {}) {
    return [...new Set([values?.apiKey, ...Object.values(headers)].filter(value => typeof value === 'string' && value.length >= 4))];
  }

  function redact(text, secrets) {
    let value = String(text || '');
    for (const secret of secrets) value = value.split(secret).join('[已隐藏鉴权信息]');
    return value;
  }

  function errorText(error, values) {
    let headers = {};
    try { headers = parseHeaders(values?.customHeaders, values || {}); } catch {}
    return redact(error?.message || '请求失败，请检查接口地址和权限。', secretsFor(values, headers));
  }

  function normalize(payload, secrets = []) {
    const items = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : Array.isArray(payload) ? payload : null;
    if (!items) throw fail('上游未返回可识别的模型列表。可继续手动填写服务商提供的模型 ID。', 'MODEL_LIST_FORMAT');
    const text = (value, max = 160) => typeof value === 'string' ? redact(value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim(), secrets).slice(0, max) : '';
    const strings = value => Array.isArray(value) ? [...new Set(value.slice(0, 20).map(item => text(item, 80)).filter(Boolean))] : [];
    const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1e9 ? Math.floor(value) : null;
    const models = [], seen = new Set();
    let skipped = 0;
    for (const item of items) {
      const id = typeof item?.id === 'string' ? item.id.trim() : typeof item?.name === 'string' ? item.name.trim() : '';
      if (!id || id.length > 256 || /[\u0000-\u001f\u007f]/.test(id) || secrets.some(secret => id.includes(secret))) { skipped += 1; continue; }
      if (seen.has(id)) continue;
      seen.add(id);
      if (models.length >= LIMIT) continue;
      models.push({
        id,
        name: text(item.name || item.display_name),
        owner: text(item.owned_by || item.organization),
        description: text(item.description, 600),
        inputModalities: strings(item.input_modalities || item.architecture?.input_modalities),
        outputModalities: strings(item.output_modalities || item.architecture?.output_modalities),
        contextWindow: positive(item.context_length ?? item.context_window ?? item.max_model_len),
        maxOutput: positive(item.max_output_tokens ?? item.top_provider?.max_completion_tokens),
        endpoints: strings(item.supported_endpoints || item.supported_endpoint_types),
        shutdownDate: /^\d{4}-\d{2}-\d{2}$/.test(item.shutdown_date || '') ? item.shutdown_date : ''
      });
    }
    models.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
    return { models, truncated: seen.size > LIMIT || payload?.has_more === true, skipped };
  }

  async function fetchModels(values, controller) {
    if (!values || typeof values !== 'object' || Array.isArray(values) || JSON.stringify(values).length > 80000) throw fail('连接配置无效或过大。', 'INVALID_SETTINGS');
    if (values.apiStyle !== 'openai-compatible') throw fail('仅 OpenAI 兼容接口支持读取此模型列表。', 'UNSUPPORTED_PROVIDER');
    const url = endpoint(values.endpoint);
    if (typeof values.apiKey !== 'string' || !values.apiKey.trim()) throw fail('请先填写此服务商的 API Key。', 'API_KEY_REQUIRED');
    let headers;
    try { headers = parseHeaders(values.customHeaders, values); } catch { throw fail('自定义请求头必须是有效的 JSON 对象。', 'INVALID_HEADERS'); }
    if (!hasHeader(headers, 'Authorization')) headers.Authorization = `Bearer ${values.apiKey}`;
    if (!hasHeader(headers, 'Accept')) headers.Accept = 'application/json';
    if (!(await permissionsContains([getOriginPattern(url.href)]))) throw fail('请先允许访问所填 API 域名，再读取模型列表。', 'PERMISSION_REQUIRED');
    if (controller.signal.aborted) throw fail('已取消读取模型。', 'CANCELLED');
    const secrets = secretsFor(values, headers);
    const stopKeepAlive = keepApiAlive(controller);
    try {
      const response = await fetch(url.href, { method: 'GET', headers, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store', signal: controller.signal });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        const hint = response.status === 401 || response.status === 403 ? '请检查 API Key 及模型列表访问权限。' : response.status === 404 || response.status === 405 ? '上游可能未提供标准 models 接口，可手动填写模型 ID。' : response.status === 429 ? '上游限流或额度不足，请稍后重试。' : '上游暂时无法提供模型列表。';
        throw fail(`读取模型失败（HTTP ${response.status}）。${hint}`, `HTTP_${response.status}`);
      }
      let payload;
      const raw = await boundedJsonText(response);
      try { payload = JSON.parse(raw); } catch { throw fail('模型接口未返回 JSON。请确认填写的是 API 地址而非网站首页。', 'MODEL_LIST_FORMAT'); }
      return { ...normalize(payload, secrets), source: redact(url.origin + url.pathname, secrets) };
    } catch (error) {
      if (controller.signal.aborted) throw fail('已取消读取模型。', 'CANCELLED');
      if (error.code) throw error;
      throw fail('无法读取模型列表。请检查网络、API 地址和权限；重定向地址不会被自动跟随。', 'NETWORK_ERROR');
    } finally { stopKeepAlive(); }
  }

  return { endpoint, normalize, fetchModels, errorText };
})();

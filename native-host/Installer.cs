using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

// The downloaded installer is a separate Windows program. Browser extensions
// cannot execute it, so the user must open the downloaded file explicitly.
internal static class Installer {
  const string BundleResource = "QudadFlowBridgeBundle";
  const long MaxEntryBytes = 150L * 1024L * 1024L;
  const long MaxTotalBytes = 220L * 1024L * 1024L;

  static string ScratchDirectory() {
    string parent = Path.GetFullPath(Path.GetTempPath());
    string scratch = Path.GetFullPath(Path.Combine(parent, "QudadFlowBridgeSetup-" + Guid.NewGuid().ToString("N")));
    if (!scratch.StartsWith(parent, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Invalid temporary directory.");
    Directory.CreateDirectory(scratch);
    return scratch;
  }

  static string Sha256(string file) {
    using (Stream input = File.OpenRead(file))
    using (SHA256 sha = SHA256.Create()) {
      return BitConverter.ToString(sha.ComputeHash(input)).Replace("-", "").ToLowerInvariant();
    }
  }

  static void ExtractVerifiedBundle(string scratch) {
    Stream embedded = Assembly.GetExecutingAssembly().GetManifestResourceStream(BundleResource);
    if (embedded == null) throw new InvalidOperationException("The bundled program is missing.");
    using (embedded)
    using (ZipArchive archive = new ZipArchive(embedded, ZipArchiveMode.Read, false)) {
      ZipArchiveEntry manifestEntry = archive.GetEntry("bridge-manifest.json");
      if (manifestEntry == null || manifestEntry.Length > 128 * 1024) throw new InvalidOperationException("The bundle manifest is missing.");
      Dictionary<string, object> manifest;
      using (StreamReader reader = new StreamReader(manifestEntry.Open(), Encoding.UTF8)) {
        manifest = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(reader.ReadToEnd());
      }
      if (manifest == null || !manifest.ContainsKey("platform") ||
          !String.Equals(Convert.ToString(manifest["platform"]), "Windows x64", StringComparison.Ordinal) ||
          !manifest.ContainsKey("fileSha256")) throw new InvalidOperationException("The bundle manifest is invalid.");
      Dictionary<string, object> expected = manifest["fileSha256"] as Dictionary<string, object>;
      if (expected == null || expected.Count < 5) throw new InvalidOperationException("The bundle file list is invalid.");
      HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
      long total = 0;
      foreach (ZipArchiveEntry entry in archive.Entries) {
        string name = entry.FullName;
        if (String.IsNullOrEmpty(name) || name != entry.Name ||
            name.IndexOf('/') >= 0 || name.IndexOf('\\') >= 0 || name == "." || name == ".." ||
            !seen.Add(name)) throw new InvalidOperationException("The bundle contains an unsafe file.");
        if (name == "bridge-manifest.json") continue;
        object value;
        if (!expected.TryGetValue(name, out value)) throw new InvalidOperationException("The bundle contains an unexpected file.");
        string digest = Convert.ToString(value);
        if (!Regex.IsMatch(digest, "^[a-fA-F0-9]{64}$")) throw new InvalidOperationException("The bundle has an invalid checksum.");
        if (entry.Length < 0 || entry.Length > MaxEntryBytes || total + entry.Length > MaxTotalBytes) throw new InvalidOperationException("The bundle is too large.");
        string destination = Path.Combine(scratch, name);
        using (Stream input = entry.Open())
        using (Stream output = new FileStream(destination, FileMode.CreateNew, FileAccess.Write, FileShare.None)) {
          byte[] buffer = new byte[81920];
          long written = 0;
          int count;
          while ((count = input.Read(buffer, 0, buffer.Length)) > 0) {
            written += count;
            if (written > entry.Length || written > MaxEntryBytes || total + written > MaxTotalBytes) {
              throw new InvalidOperationException("The bundle entry exceeded its declared size.");
            }
            output.Write(buffer, 0, count);
          }
          if (written != entry.Length) throw new InvalidOperationException("The bundle entry size is invalid.");
          total += written;
        }
        if (!String.Equals(Sha256(destination), digest, StringComparison.OrdinalIgnoreCase)) {
          throw new InvalidOperationException("The bundle checksum does not match: " + name);
        }
      }
      if (seen.Count != expected.Count + 1 ||
          !File.Exists(Path.Combine(scratch, "Install-Bridge.ps1")) ||
          !File.Exists(Path.Combine(scratch, "node.exe"))) {
        throw new InvalidOperationException("The bundle is incomplete.");
      }
    }
  }

  static string RunPowerShellInstaller(string scratch) {
    string executable = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),
      "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    if (!File.Exists(executable)) throw new InvalidOperationException("Windows PowerShell is unavailable.");
    ProcessStartInfo start = new ProcessStartInfo(executable,
      "-NoProfile -ExecutionPolicy Bypass -File \"" + Path.Combine(scratch, "Install-Bridge.ps1") + "\"");
    start.UseShellExecute = false;
    start.CreateNoWindow = true;
    start.RedirectStandardOutput = true;
    start.RedirectStandardError = true;
    StringBuilder output = new StringBuilder();
    using (Process child = new Process()) {
      child.StartInfo = start;
      child.OutputDataReceived += delegate(object sender, DataReceivedEventArgs args) {
        if (args.Data != null) lock (output) output.AppendLine(args.Data);
      };
      child.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs args) {
        if (args.Data != null) lock (output) output.AppendLine(args.Data);
      };
      if (!child.Start()) throw new InvalidOperationException("Could not start the Windows installer.");
      child.BeginOutputReadLine();
      child.BeginErrorReadLine();
      if (!child.WaitForExit(120000)) {
        child.Kill();
        throw new InvalidOperationException("Installation exceeded two minutes. Check Windows security prompts and try again.");
      }
      child.WaitForExit();
      if (child.ExitCode != 0) throw new InvalidOperationException("Installation failed: " + output.ToString().Trim());
    }
    return output.ToString().Trim();
  }

  static string Install(bool selfTest) {
    if (!Environment.Is64BitOperatingSystem) throw new InvalidOperationException("This installer requires Windows x64.");
    string scratch = ScratchDirectory();
    try {
      ExtractVerifiedBundle(scratch);
      if (selfTest) return "Bundle verified.";
      return RunPowerShellInstaller(scratch);
    } finally {
      try { if (Directory.Exists(scratch)) Directory.Delete(scratch, true); }
      catch { /* Temporary files contain no credentials; install result is retained. */ }
    }
  }

  [STAThread]
  static int Main(string[] args) {
    if (args.Length == 1 && args[0] == "--self-test") {
      try { Install(true); return 0; }
      catch { return 1; }
    }
    if (args.Length != 0) return 2;
    Application.EnableVisualStyles();
    Form window = new Form();
    window.Text = "QudadFlow ChatGPT 本地连接程序";
    window.Size = new Size(460, 225);
    window.MinimumSize = window.Size;
    window.MaximumSize = window.Size;
    window.StartPosition = FormStartPosition.CenterScreen;
    window.FormBorderStyle = FormBorderStyle.FixedDialog;
    window.MaximizeBox = false;
    window.Font = new Font("Microsoft YaHei UI", 9F);
    Label heading = new Label();
    heading.Text = "正在安装可选的 ChatGPT 本地连接程序";
    heading.Font = new Font(window.Font, FontStyle.Bold);
    heading.SetBounds(22, 22, 410, 24);
    Label description = new Label();
    description.Text = "仅安装到当前 Windows 用户；默认机器翻译无需此程序。";
    description.SetBounds(22, 53, 410, 28);
    ProgressBar progress = new ProgressBar();
    progress.Style = ProgressBarStyle.Marquee;
    progress.SetBounds(22, 96, 410, 18);
    TextBox detail = new TextBox();
    detail.ReadOnly = true;
    detail.Multiline = true;
    detail.ScrollBars = ScrollBars.Vertical;
    detail.SetBounds(22, 121, 326, 54);
    Button close = new Button();
    close.Text = "关闭";
    close.Enabled = false;
    close.SetBounds(357, 131, 75, 31);
    close.Click += delegate { window.Close(); };
    window.Controls.Add(heading);
    window.Controls.Add(description);
    window.Controls.Add(progress);
    window.Controls.Add(detail);
    window.Controls.Add(close);
    bool finished = false;
    int result = 0;
    window.FormClosing += delegate(object sender, System.Windows.Forms.FormClosingEventArgs eventArgs) {
      if (!finished) eventArgs.Cancel = true;
    };
    window.Shown += delegate {
      Task.Factory.StartNew(() => Install(false)).ContinueWith(task => {
        if (window.IsDisposed) return;
        window.BeginInvoke((Action)delegate {
          finished = true;
          progress.Style = ProgressBarStyle.Blocks;
          close.Enabled = true;
          if (task.IsFaulted) {
            result = 1;
            heading.Text = "连接程序未安装";
            detail.Text = task.Exception.GetBaseException().Message;
          } else {
            heading.Text = "连接程序已安装";
            detail.Text = "回到 QudadFlow 设置页，点击“重新检测”，然后授权账号。";
          }
        });
      });
    };
    Application.Run(window);
    window.Dispose();
    return result;
  }
}

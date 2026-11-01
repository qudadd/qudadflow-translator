import './figure-spec.js';
const {validate,templateReady,columns}=globalThis.QFFigureSpec;

// Demonstrations stay separate from source data and are shared by both languages.
export function styleDemoPanels(spec){
  spec=validate(spec);
  const required=columns(spec);
  const position=(axis,t)=>{
    const range=axis.limits||(axis.ticks?.length>1?[Math.min(...axis.ticks),Math.max(...axis.ticks)]:axis.scale==='log'?[1,100]:[0,1]);
    return axis.scale==='log'?Math.exp(Math.log(range[0])+(Math.log(range[1])-Math.log(range[0]))*t):range[0]+(range[1]-range[0])*t;
  };
  return spec.panels.map(panel=>{
    if(panel.type==='custom')throw new Error('Custom geometry needs its own labelled style demonstration');
    const roles=[panel.x.column,panel.y.column,panel.series?.column,panel.filter?.column,panel.interval?.lower,panel.interval?.upper].filter(Boolean);
    if(new Set(roles).size!==roles.length)throw new Error('Style demonstration requires distinct columns within each panel; supply a CSV for shared column roles');
    const groups=panel.series?.order||[''],count=panel.type==='bar'?panel.categories.length:panel.type==='scatter'?18:9,rows=[];
    for(const [groupIndex,label]of groups.entries())for(let i=0;i<count;i++){
      const t=count===1?.5:i/(count-1),fraction=.22+.5*t+.08*Math.sin(i*1.7+groupIndex)+.1*(groupIndex/Math.max(1,groups.length-1));
      const row=Object.fromEntries(required.map(column=>[column,'']));
      row[panel.x.column]=panel.type==='bar'?panel.categories[i]:String(position(panel.x,.08+.84*t));
      row[panel.y.column]=String(position(panel.y,fraction));
      if(panel.series)row[panel.series.column]=label;
      if(panel.filter)row[panel.filter.column]=panel.filter.value;
      if(panel.interval){row[panel.interval.lower]=String(position(panel.y,fraction-.07));row[panel.interval.upper]=String(position(panel.y,fraction+.07));}
      rows.push(row);
    }
    return rows;
  });
}

// The extension generates text; code runs only in the user's local interpreter.
const python=String.raw`# QudadFlow reproduction draft. Not executed by the extension.
# Requires Python 3, pandas, numpy, matplotlib. Place the documented CSV beside this script.
# No aggregation, smoothing, interpolation, statistics inference or data download.
# Run with --style-demo to inspect form, palette and legends using labelled synthetic values.
from pathlib import Path
import csv
import json
import math
import sys
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import NullLocator

SPEC = json.loads(__SPEC__)
REQUIRED = __COLUMNS__
BASE = Path(__file__).resolve().parent
STYLE_DEMO = "--style-demo" in sys.argv[1:]
DEMO = json.loads(__DEMO__)

def read_data():
    source = BASE / SPEC["data"]["file"]
    if not source.is_file():
        raise ValueError(f"Missing {source.name}; required columns: {', '.join(REQUIRED)}. Supply original or explicitly digitized data; no example rows were generated.")
    with source.open(encoding="utf-8-sig", newline="") as stream:
        header = next(csv.reader(stream), [])
    if len(header) != len(set(header)):
        raise ValueError("Duplicate CSV column names")
    data = pd.read_csv(source, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    missing = [c for c in REQUIRED if c not in data.columns]
    if missing:
        raise ValueError("Missing columns: " + ", ".join(missing))
    if data.empty:
        raise ValueError("CSV has no observations; supply documented values")
    return data

def numeric(frame, column):
    try:
        values = pd.to_numeric(frame[column], errors="raise").to_numpy(dtype=float)
    except (ValueError, TypeError) as exc:
        raise ValueError(f"Column {column} must contain finite numeric values") from exc
    if not np.isfinite(values).all():
        raise ValueError(f"Column {column} must contain finite numeric values (no blanks/NaN/Inf)")
    return values

def prepare(data, panel):
    frame = data.copy()
    if panel["filter"]:
        f = panel["filter"]
        frame = frame.loc[frame[f["column"]] == f["value"]].copy()
    if frame.empty:
        raise ValueError(f"Panel {panel['id']} has no observations after filtering")
    raw = frame.copy()  # Preserve user columns even if named _x/_y/_lower.
    series = panel["series"]
    order = series["order"] if series else [""]
    frame["_series"] = raw[series["column"]] if series else ""
    if set(frame["_series"]) != set(order):
        raise ValueError(f"Panel {panel['id']}: series values must match declared order {order}")
    frame["_y"] = numeric(raw, panel["y"]["column"])
    if panel["type"] == "bar":
        frame["_x"] = raw[panel["x"]["column"]]
        if set(frame["_x"]) != set(panel["categories"]):
            raise ValueError("Bar categories must match declared order exactly")
    else:
        frame["_x"] = numeric(raw, panel["x"]["column"])
    interval = panel["interval"]
    if interval:
        frame["_lower"] = numeric(raw, interval["lower"])
        frame["_upper"] = numeric(raw, interval["upper"])
        if ((frame["_lower"] > frame["_y"]) | (frame["_upper"] < frame["_y"])).any():
            raise ValueError("Interval endpoints must satisfy lower <= y <= upper; SD/SE magnitudes are not endpoints")
    for key in ("x", "y"):
        if panel[key]["scale"] == "log":
            if (frame["_" + key] <= 0).any() or (key == "y" and interval and (frame["_lower"] <= 0).any()):
                raise ValueError("Log axis values and interval endpoints must be positive")
        limits = panel[key]["limits"]
        if limits and ((frame["_" + key] < limits[0]) | (frame["_" + key] > limits[1])).any():
            warnings.warn(f"Panel {panel['id']}: values outside declared {key} limits will be clipped")
    groups, audit = [], []
    for label in order:
        group = frame.loc[frame["_series"] == label].copy()
        if panel["type"] in ("line", "bar") and group["_x"].duplicated().any():
            raise ValueError("Duplicate x within series; explicit documented aggregation is required")
        if panel["type"] == "bar":
            if set(group["_x"]) != set(panel["categories"]):
                raise ValueError("Missing bar category within series; no values will be imputed")
            group = group.set_index("_x", drop=False).loc[panel["categories"]]
        elif panel["type"] == "line":
            group = group.sort_values("_x", kind="stable")
        record = dict(label=label, x=group["_x"].tolist(), y=group["_y"].tolist())
        if interval:
            record.update(lower=group["_lower"].tolist(), upper=group["_upper"].tolist())
        groups.append((label, group)); audit.append(record)
    return groups, dict(id=panel["id"], type=panel["type"], rows=len(frame), interval=interval, groups=audit)

def draw(ax, panel, groups):
    style = SPEC["style"]
    for index, (label, group) in enumerate(groups):
        color = style["palette"][index]
        x, y = group["_x"].to_numpy(), group["_y"].to_numpy(dtype=float)
        error = np.array([y-group["_lower"], group["_upper"]-y]) if panel["interval"] else None
        if panel["type"] == "line":
            ax.plot(x, y, label=label, color=color, linewidth=style["lineWidth"], marker="o" if style["pointSize"] else None, markersize=style["pointSize"])
            if error is not None:
                ax.fill_between(x, group["_lower"].to_numpy(dtype=float), group["_upper"].to_numpy(dtype=float), color=color, alpha=.18, linewidth=0)
        elif panel["type"] == "scatter":
            ax.scatter(x, y, label=label, color=color, s=style["pointSize"]**2)
            if error is not None:
                ax.errorbar(x, y, yerr=error, fmt="none", ecolor=color, capsize=3, linewidth=style["lineWidth"])
        else:
            width = .8 / len(groups)
            positions = np.arange(len(panel["categories"])) + (index-(len(groups)-1)/2)*width
            ax.bar(positions, y, width=width, label=label, color=color, yerr=error, ecolor="black", capsize=3, error_kw={"elinewidth": style["lineWidth"]})
    for key in ("x", "y"):
        a = panel[key]
        getattr(ax, "set_"+key+"scale")("log" if a["scale"] == "log" else "linear")
        getattr(ax, "set_"+key+"label")(a["label"])
        if a["ticks"] is not None:
            getattr(ax, "set_"+key+"ticks")(a["ticks"], labels=[format(n, ".12g") for n in a["ticks"]])
            getattr(ax, key+"axis").set_minor_locator(NullLocator())
        if a["limits"] is not None: getattr(ax, "set_"+key+"lim")(*a["limits"])
    if panel["type"] == "bar":
        # Changing a scale resets its locator, so categorical ticks must be applied last.
        ax.set_xticks(np.arange(len(panel["categories"])), panel["categories"])
    ax.set_title(panel["title"])
    ax.grid(style["grid"], alpha=.2) if style["grid"] else ax.grid(False)
    ax.set_axisbelow(True)
    for side in ("top", "right"): ax.spines[side].set_visible(style["spines"] == "box")
    if panel["series"] and style["legend"] != "none":
        place = {"top": dict(loc="lower center", bbox_to_anchor=(.5, 1.12), ncol=len(groups)), "right": dict(loc="center left", bbox_to_anchor=(1, .5)), "bottom": dict(loc="upper center", bbox_to_anchor=(.5, -.2), ncol=len(groups))}
        ax.legend(frameon=False, **place[style["legend"]])

def main():
    stem = "figure-style-demo" if STYLE_DEMO else "figure"
    audit_name = "style-demo-audit.json" if STYLE_DEMO else "render-audit.json"
    outputs = [BASE / (stem+"."+ext) for ext in ("png", "pdf", "svg")] + [BASE / audit_name]
    existing = [p.name for p in outputs if p.exists()]
    if existing:
        raise FileExistsError("Existing outputs: " + ", ".join(existing) + "; move them to another directory before rerunning. Nothing was overwritten.")
    if STYLE_DEMO:
        if DEMO["error"]: raise ValueError(DEMO["error"])
        prepared = [prepare(pd.DataFrame(rows), panel) for rows, panel in zip(DEMO["panels"], SPEC["panels"])]
    else:
        data = read_data()
        prepared = [prepare(data, panel) for panel in SPEC["panels"]]
    style, canvas = SPEC["style"], SPEC["canvas"]
    family = "sans-serif" if style["fontFamily"] == "sans" else style["fontFamily"]
    plt.rcParams.update({"font.family": family, "font.size": style["fontSize"], "pdf.fonttype": 42, "svg.fonttype": "none"})
    cols = SPEC["layout"]["columns"]; rows = math.ceil(len(prepared)/cols)
    fig, axes = plt.subplots(rows, cols, figsize=(canvas["width"], canvas["height"]), squeeze=False, layout="constrained")
    for ax, panel, (groups, _) in zip(axes.flat, SPEC["panels"], prepared): draw(ax, panel, groups)
    for ax in list(axes.flat)[len(prepared):]: ax.set_visible(False)
    if SPEC["title"]: fig.suptitle(SPEC["title"])
    if STYLE_DEMO: fig.supxlabel("STYLE DEMO - synthetic values; layout only", fontsize=style["fontSize"]*.8)
    elif SPEC["data"]["status"] == "digitized": fig.supxlabel("Image-digitized estimates; verify against original data", fontsize=style["fontSize"]*.8)
    for ext in ("png", "pdf", "svg"): fig.savefig(BASE / (stem+"."+ext), dpi=canvas["dpi"], facecolor="white")
    plt.close(fig)
    audit = dict(schema="qudadflow.render-audit/v1", data=SPEC["data"], canvas=canvas, aggregation="none", smoothing="none", unresolved=SPEC["unresolved"], panels=[record for _, record in prepared])
    audit["mode"] = "style-demo" if STYLE_DEMO else "supplied-data"
    if STYLE_DEMO: audit["data"] = dict(status="synthetic", source="Deterministic style demonstration; not source observations")
    (BASE / audit_name).write_text(json.dumps(audit, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    print(f"Rendered {stem}.png / .pdf / .svg. Compare form, fonts, colors, legends and spacing against the reference.")

if __name__ == "__main__": main()
`;

const r=String.raw`# QudadFlow reproduction draft. Not executed by the extension.
# Requires R, ggplot2, jsonlite, svglite. Place the documented CSV beside this script.
# No aggregation, smoothing, interpolation, statistics inference or data download.
# Run with --style-demo to inspect form, palette and legends using labelled synthetic values.
# cli's Windows finalizer expects PROCESSOR_ARCHITECTURE, which some task runners omit.
# Restore missing OS metadata in this process only, before ggplot2 loads cli.
if (.Platform$OS.type == "windows" && !nzchar(Sys.getenv("PROCESSOR_ARCHITECTURE"))) {
  machine <- tolower(Sys.info()[["machine"]])
  arch <- switch(machine, "x86-64"="AMD64", "x86_64"="AMD64", "amd64"="AMD64", "aarch64"="ARM64", "arm64"="ARM64", "x86"="x86", "i386"="x86", stop("Cannot identify Windows process architecture"))
  Sys.setenv(PROCESSOR_ARCHITECTURE=arch)
}
# Some Windows launchers inherit the Unix-only C.UTF-8 locale. Keep Unicode paths valid in this R process.
if (.Platform$OS.type == "windows" && !l10n_info()[["UTF-8"]]) {
  locale <- suppressWarnings(Sys.setlocale("LC_CTYPE", ".UTF-8"))
  if (!nzchar(locale)) stop("A UTF-8-capable R runtime is required for Unicode paths")
}
suppressPackageStartupMessages(library(ggplot2))
suppressPackageStartupMessages(library(jsonlite))
if (!requireNamespace("svglite", quietly=TRUE)) stop("Install the svglite R package before rendering editable SVG text")
SPEC <- fromJSON(__SPEC__, simplifyVector=FALSE)
REQUIRED <- c(__COLUMNS__)
script_arg <- grep("^--file=", commandArgs(FALSE), value=TRUE)
BASE <- if (length(script_arg)) dirname(normalizePath(sub("^--file=", "", script_arg[1]), mustWork=TRUE)) else getwd()
STYLE_DEMO <- "--style-demo" %in% commandArgs(trailingOnly=TRUE)
DEMO <- fromJSON(__DEMO__, simplifyVector=FALSE)
vec <- function(x) unlist(x, use.names=FALSE)

read_data <- function() {
  source <- file.path(BASE, SPEC$data$file)
  if (!file.exists(source)) stop(paste("Missing", SPEC$data$file, "; required columns:", paste(REQUIRED, collapse=", "), ". Supply documented values; no example rows were generated."))
  data <- read.csv(source, stringsAsFactors=FALSE, colClasses="character", check.names=FALSE, fileEncoding="UTF-8-BOM", na.strings=NULL)
  if (anyDuplicated(names(data))) stop("Duplicate CSV column names")
  missing <- setdiff(REQUIRED, names(data))
  if (length(missing)) stop(paste("Missing columns:", paste(missing, collapse=", ")))
  if (!nrow(data)) stop("CSV has no observations; supply documented values")
  data
}

numeric_column <- function(frame, column) {
  values <- suppressWarnings(as.numeric(frame[[column]]))
  if (any(!is.finite(values))) stop(paste("Column", column, "must contain finite numeric values (no blanks/NaN/Inf)"))
  values
}

prepare <- function(data, panel) {
  frame <- data
  if (!is.null(panel$filter)) frame <- frame[frame[[panel$filter$column]] == panel$filter$value, , drop=FALSE]
  if (!nrow(frame)) stop(paste("Panel", panel$id, "has no observations after filtering"))
  raw <- frame # Preserve user columns even if named .x/.y/.lower.
  series <- panel$series
  order <- if (is.null(series)) "" else vec(series$order)
  frame$.series <- if (is.null(series)) rep("", nrow(frame)) else raw[[series$column]]
  if (!setequal(unique(frame$.series), order)) stop(paste("Panel", panel$id, ": series values must match declared order"))
  frame$.y <- numeric_column(raw, panel$y$column)
  if (panel$type == "bar") {
    frame$.x <- raw[[panel$x$column]]
    if (!setequal(unique(frame$.x), vec(panel$categories))) stop("Bar categories must match declared order exactly")
  } else frame$.x <- numeric_column(raw, panel$x$column)
  interval <- panel$interval
  if (!is.null(interval)) {
    frame$.lower <- numeric_column(raw, interval$lower)
    frame$.upper <- numeric_column(raw, interval$upper)
    if (any(frame$.lower > frame$.y | frame$.upper < frame$.y)) stop("Interval endpoints must satisfy lower <= y <= upper; SD/SE magnitudes are not endpoints")
  }
  for (key in c("x", "y")) {
    a <- panel[[key]]; values <- frame[[paste0(".", key)]]
    if (a$scale == "log" && (any(values <= 0) || (key == "y" && !is.null(interval) && any(frame$.lower <= 0)))) stop("Log axis values and interval endpoints must be positive")
    limits <- vec(a$limits)
    if (length(limits) && any(values < limits[1] | values > limits[2])) warning(paste("Panel", panel$id, ": values outside declared", key, "limits will be clipped"))
  }
  groups <- list(); audit <- list()
  for (label in order) {
    group <- frame[frame$.series == label, , drop=FALSE]
    if (panel$type %in% c("line", "bar") && anyDuplicated(group$.x)) stop("Duplicate x within series; explicit documented aggregation is required")
    if (panel$type == "bar") {
      if (!setequal(group$.x, vec(panel$categories))) stop("Missing bar category within series; no values will be imputed")
      group <- group[match(vec(panel$categories), group$.x), , drop=FALSE]
    } else if (panel$type == "line") group <- group[order(group$.x), , drop=FALSE]
    record <- list(label=label, x=I(group$.x), y=I(group$.y))
    if (!is.null(interval)) { record$lower <- I(group$.lower); record$upper <- I(group$.upper) }
    groups[[length(groups)+1]] <- group; audit[[length(audit)+1]] <- record
  }
  frame <- do.call(rbind, groups)
  frame$.series <- factor(frame$.series, levels=order)
  if (panel$type == "bar") frame$.x <- factor(frame$.x, levels=vec(panel$categories))
  list(frame=frame, audit=list(id=panel$id, type=panel$type, rows=nrow(frame), interval=interval, groups=audit))
}

draw_panel <- function(panel, prepared) {
  style <- SPEC$style; mm <- 25.4/72
  frame <- prepared$frame
  plot <- ggplot(frame, aes(x=.x, y=.y, group=.series, colour=.series))
  if (panel$type == "line") {
    if (!is.null(panel$interval)) plot <- plot + geom_ribbon(aes(ymin=.lower, ymax=.upper, fill=.series), colour=NA, alpha=.18, show.legend=FALSE)
    plot <- plot + geom_line(linewidth=style$lineWidth*mm)
    if (style$pointSize > 0) plot <- plot + geom_point(size=style$pointSize*mm)
  } else if (panel$type == "scatter") {
    plot <- plot + geom_point(size=style$pointSize*mm)
    if (!is.null(panel$interval)) plot <- plot + geom_errorbar(aes(ymin=.lower, ymax=.upper), width=.05, linewidth=style$lineWidth*mm)
  } else {
    plot <- plot + geom_col(aes(fill=.series), position=position_dodge(width=.8), width=.8, colour=NA)
    if (!is.null(panel$interval)) plot <- plot + geom_errorbar(aes(ymin=.lower, ymax=.upper), position=position_dodge(width=.8), width=.15, linewidth=style$lineWidth*mm, colour="black", show.legend=FALSE)
  }
  colors <- setNames(vec(style$palette)[seq_along(levels(frame$.series))], levels(frame$.series))
  plot <- plot + scale_colour_manual(values=colors, drop=FALSE)
  if (panel$type == "bar" || (panel$type == "line" && !is.null(panel$interval))) plot <- plot + scale_fill_manual(values=colors, drop=FALSE)
  for (key in c("x", "y")) {
    if (key == "x" && panel$type == "bar") next
    a <- panel[[key]]; breaks <- if (is.null(a$ticks)) waiver() else vec(a$ticks)
    labels <- if (is.null(a$ticks)) waiver() else sprintf("%.12g", vec(a$ticks))
    # Coordinate limits clip the display without removing observations or changing statistics.
    scale_fun <- if (key == "x") scale_x_continuous else scale_y_continuous
    plot <- plot + scale_fun(transform=if (a$scale == "log") "log10" else "identity", breaks=breaks, labels=labels, minor_breaks=if (is.null(a$ticks)) waiver() else NULL, expand=if (is.null(a$limits)) waiver() else expansion(mult=0))
  }
  plot <- plot + coord_cartesian(xlim=vec(panel$x$limits), ylim=vec(panel$y$limits))
  legend <- if (is.null(panel$series)) "none" else style$legend
  plot <- plot + labs(x=panel$x$label, y=panel$y$label, title=panel$title, colour=NULL, fill=NULL) +
    theme_classic(base_size=style$fontSize, base_family=style$fontFamily) +
    theme(legend.position=legend, plot.title=element_text(hjust=.5), plot.margin=margin(8,8,8,8),
      axis.text=element_text(size=style$fontSize), legend.text=element_text(size=style$fontSize),
      axis.line=element_line(linewidth=.8*mm), axis.ticks=element_line(linewidth=.8*mm),
      panel.grid=if (style$grid) element_line(colour="#dddddd", linewidth=.25) else element_blank(),
      panel.border=if (style$spines == "box") element_rect(fill=NA, colour="black", linewidth=.35) else element_blank())
  plot
}

main <- function() {
  stem <- if (STYLE_DEMO) "figure-style-demo" else "figure"
  audit_name <- if (STYLE_DEMO) "style-demo-audit.json" else "render-audit.json"
  outputs <- file.path(BASE, c(paste0(stem,c(".png",".pdf",".svg")),audit_name))
  existing <- basename(outputs[file.exists(outputs)])
  if (length(existing)) stop(paste("Existing outputs:", paste(existing, collapse=", "), "; move them to another directory before rerunning. Nothing was overwritten."))
  if (STYLE_DEMO) {
    if (nzchar(DEMO$error)) stop(DEMO$error)
    prepared <- Map(function(rows,panel) prepare(do.call(rbind,lapply(rows,as.data.frame,stringsAsFactors=FALSE)),panel),DEMO$panels,SPEC$panels)
  } else {
    data <- read_data()
    prepared <- lapply(SPEC$panels, function(panel) prepare(data, panel))
  }
  plots <- Map(draw_panel, SPEC$panels, prepared)
  canvas <- SPEC$canvas; cols <- SPEC$layout$columns; rows <- ceiling(length(plots)/cols)
  title_row <- nzchar(SPEC$title); estimate_row <- STYLE_DEMO || SPEC$data$status == "digitized"
  draw_all <- function() {
    grid::grid.newpage()
    heights <- grid::unit(rep(1,rows),"null")
    if (title_row) heights <- grid::unit.c(grid::unit(.3,"in"),heights)
    if (estimate_row) heights <- grid::unit.c(heights,grid::unit(.22,"in"))
    grid::pushViewport(grid::viewport(layout=grid::grid.layout(rows+title_row+estimate_row, cols, heights=heights)))
    if (title_row) grid::grid.text(SPEC$title, vp=grid::viewport(layout.pos.row=1, layout.pos.col=seq_len(cols)), gp=grid::gpar(fontfamily=SPEC$style$fontFamily, fontsize=SPEC$style$fontSize*1.2))
    for (i in seq_along(plots)) print(plots[[i]], newpage=FALSE, vp=grid::viewport(layout.pos.row=ceiling(i/cols)+title_row, layout.pos.col=(i-1)%%cols+1))
    if (estimate_row) grid::grid.text(if (STYLE_DEMO) "STYLE DEMO - synthetic values; layout only" else "Image-digitized estimates; verify against original data", vp=grid::viewport(layout.pos.row=rows+title_row+1, layout.pos.col=seq_len(cols)), gp=grid::gpar(fontsize=SPEC$style$fontSize*.8))
    grid::popViewport()
  }
  export <- function(device) { device(); on.exit(grDevices::dev.off()); draw_all() }
  export(function() grDevices::png(file.path(BASE,paste0(stem,".png")), width=canvas$width, height=canvas$height, units="in", res=canvas$dpi))
  export(function() grDevices::cairo_pdf(file.path(BASE,paste0(stem,".pdf")), width=canvas$width, height=canvas$height, family=SPEC$style$fontFamily))
  export(function() svglite::svglite(file.path(BASE,paste0(stem,".svg")), width=canvas$width, height=canvas$height))
  audit <- list(schema="qudadflow.render-audit/v1", data=SPEC$data, canvas=canvas, aggregation="none", smoothing="none", unresolved=SPEC$unresolved, panels=lapply(prepared, function(x) x$audit))
  audit$mode <- if (STYLE_DEMO) "style-demo" else "supplied-data"
  if (STYLE_DEMO) audit$data <- list(status="synthetic",source="Deterministic style demonstration; not source observations")
  writeLines(toJSON(audit, auto_unbox=TRUE, pretty=TRUE, null="null", digits=16), file.path(BASE,audit_name), useBytes=TRUE)
  cat(paste0("Rendered ",stem,".png / .pdf / .svg. Compare form, fonts, colors, legends and spacing against the reference.\n"))
}
main()
`;

export function figureCode(spec,language){
  spec=validate(spec);
  if(!['python','r'].includes(language))throw new Error('仅支持 Python 和 R');
  if(!templateReady(spec))throw new Error('特殊图形需保留 AI 自定义代码，不能套用通用模板');
  let demo;try{demo={panels:styleDemoPanels(spec),error:''};}catch(error){demo={panels:[],error:error.message};}
  const literal=value=>{const lines=JSON.stringify(value,null,2).split('\n').map(line=>JSON.stringify(line+'\n'));return language==='r'?'paste0(\n  '+lines.join(',\n  ')+'\n)':'(\n    '+lines.join('\n    ')+'\n)';};
  const code=language==='r'?r:python;
  return code.replace('__SPEC__',()=>literal(spec)).replace('__DEMO__',()=>literal(demo)).replace('__COLUMNS__',()=>language==='r'?columns(spec).map(c=>JSON.stringify(c)).join(', '):JSON.stringify(columns(spec)));
}

export function figureNotes(spec,language){
  const extension=language==='r'?'R':'py',command=language==='r'?'Rscript QudadFlow-figure.R':'python QudadFlow-figure.py';
  return `# 图表样式复刻\n\n插件尚未执行此代码。依赖：${language==='r'?'R、ggplot2、jsonlite、svglite':'Python 3、pandas、numpy、matplotlib'}。\n\n下载 QudadFlow-figure.${extension} 后，先用内置演示数据查看形式与风格，无需准备 CSV：\n\n\`\`\`text\n${command} --style-demo\n\`\`\`\n\n输出 figure-style-demo.png / .pdf / .svg，带 STYLE DEMO 标记；演示值用于排版，不代表论文观测或统计结果。两种语言使用同一组演示值，按面板独立绘制。\n\n验收顺序：图种与面板布局 → 图层与标注 → 坐标轴与刻度形式 → 字体、配色、线型、图例 → 留白和导出。只检查形式与风格，不要求数值还原，也不计算相似度分数。可导入试运行图，与原图对照修订。\n\n如需替换成自己的数据，将 ${spec.data.file} 放在脚本目录，运行 ${command}（不加 --style-demo）。CSV 必需列：${columns(spec).join('、')}。空模板只有表头。数据状态：${spec.data.status}。来源：${spec.data.source}。${spec.data.notes}\n\n区间列使用上下界端点；脚本不推断 SD、SE 或 CI、不聚合、不平滑、不补值。正式数据输出 figure.png / .pdf / .svg 和 render-audit.json；演示记录单独保存为 style-demo-audit.json。同名输出已存在时停止，请先移动上轮结果。Python/R 字体和排版引擎会有差异。\n\n待确认：\n${spec.unresolved.map(s=>'- '+s).join('\n')||'- 无已列出问题；仍需与原图核对。'}\n`;
}

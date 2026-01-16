"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const core = require("@actions/core");
const fs = require("node:fs");
const path = require("node:path");
const node_child_process = require("node:child_process");
var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const core__namespace = /* @__PURE__ */ _interopNamespaceDefault(core);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
function findFusionApps(patterns) {
  const apps = [];
  for (const pattern of patterns) {
    try {
      let searchDirs = [];
      if (pattern.includes("*")) {
        const basePath = pattern.replace("/*", "");
        if (fs__namespace.existsSync(basePath) && fs__namespace.lstatSync(basePath).isDirectory()) {
          const entries = fs__namespace.readdirSync(basePath);
          searchDirs = entries.map((entry) => path__namespace.join(basePath, entry)).filter((dirPath) => {
            return fs__namespace.lstatSync(dirPath).isDirectory();
          });
        } else {
          core__namespace.warning(`⚠️ Base path does not exist or is not a directory: ${basePath}`);
        }
      } else {
        if (fs__namespace.existsSync(pattern) && fs__namespace.lstatSync(pattern).isDirectory()) {
          searchDirs = [pattern];
        } else {
          core__namespace.warning(`⚠️ Direct path does not exist: ${pattern}`);
        }
      }
      for (const dir of searchDirs) {
        const packageJsonPath = path__namespace.join(dir, "package.json");
        if (fs__namespace.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs__namespace.readFileSync(packageJsonPath, "utf8"));
            const appName = packageJson.name || path__namespace.basename(dir);
            if (isFusionApp(packageJson)) {
              apps.push({
                name: appName,
                path: dir
              });
            }
          } catch (parseError) {
            core__namespace.warning(
              `⚠️ Could not parse ${packageJsonPath}: ${parseError instanceof Error ? parseError.message : String(parseError)}`
            );
          }
        }
      }
    } catch (patternError) {
      core__namespace.warning(
        `⚠️ Pattern ${pattern} failed: ${patternError instanceof Error ? patternError.message : String(patternError)}`
      );
    }
  }
  return apps;
}
function isFusionApp(packageJson) {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  const fusionDeps = Object.keys(allDeps).filter((dep) => dep.startsWith("@equinor/fusion"));
  const hasFusionDeps = fusionDeps.length > 0;
  if (!hasFusionDeps) return false;
  const hasCli = !!allDeps["@equinor/fusion-framework-cli"];
  const scripts = packageJson.scripts || {};
  const hasAppScripts = Object.keys(scripts).some(
    (script) => script.includes("build") || script.includes("start") || (scripts[script] || "").includes("fusion-framework-cli") || (scripts[script] || "").includes("ffc")
  );
  const hasAppConfig = !!(packageJson.fusion || packageJson.fusionApp);
  const isLibrary = !!(packageJson.main || packageJson.module || packageJson.exports);
  const isPublishable = !packageJson.private && isLibrary;
  if (isPublishable && !hasAppScripts && !hasAppConfig) {
    return false;
  }
  return hasCli || hasAppScripts || hasAppConfig || !!packageJson.private;
}
function findChangedApps(changedFiles, allApps) {
  const changedApps = [];
  for (const app of allApps) {
    const isChanged = changedFiles.some((file) => {
      const normalizedFile = file.startsWith("./") ? file.slice(2) : file;
      const normalizedAppPath = app.path.startsWith("./") ? app.path.slice(2) : app.path;
      return normalizedFile.startsWith(`${normalizedAppPath}/`) || normalizedFile === normalizedAppPath || file === "**/*";
    });
    if (isChanged) {
      changedApps.push(app);
    }
  }
  return changedApps;
}
var shellQuote = {};
var quote;
var hasRequiredQuote;
function requireQuote() {
  if (hasRequiredQuote) return quote;
  hasRequiredQuote = 1;
  quote = function quote2(xs) {
    return xs.map(function(s) {
      if (s === "") {
        return "''";
      }
      if (s && typeof s === "object") {
        return s.op.replace(/(.)/g, "\\$1");
      }
      if (/["\s\\]/.test(s) && !/'/.test(s)) {
        return "'" + s.replace(/(['])/g, "\\$1") + "'";
      }
      if (/["'\s]/.test(s)) {
        return '"' + s.replace(/(["\\$`!])/g, "\\$1") + '"';
      }
      return String(s).replace(/([A-Za-z]:)?([#!"$&'()*,:;<=>?@[\\\]^`{|}])/g, "$1\\$2");
    }).join(" ");
  };
  return quote;
}
var parse;
var hasRequiredParse;
function requireParse() {
  if (hasRequiredParse) return parse;
  hasRequiredParse = 1;
  var CONTROL = "(?:" + [
    "\\|\\|",
    "\\&\\&",
    ";;",
    "\\|\\&",
    "\\<\\(",
    "\\<\\<\\<",
    ">>",
    ">\\&",
    "<\\&",
    "[&;()|<>]"
  ].join("|") + ")";
  var controlRE = new RegExp("^" + CONTROL + "$");
  var META = "|&;()<> \\t";
  var SINGLE_QUOTE = '"((\\\\"|[^"])*?)"';
  var DOUBLE_QUOTE = "'((\\\\'|[^'])*?)'";
  var hash = /^#$/;
  var SQ = "'";
  var DQ = '"';
  var DS = "$";
  var TOKEN = "";
  var mult = 4294967296;
  for (var i = 0; i < 4; i++) {
    TOKEN += (mult * Math.random()).toString(16);
  }
  var startsWithToken = new RegExp("^" + TOKEN);
  function matchAll(s, r) {
    var origIndex = r.lastIndex;
    var matches = [];
    var matchObj;
    while (matchObj = r.exec(s)) {
      matches.push(matchObj);
      if (r.lastIndex === matchObj.index) {
        r.lastIndex += 1;
      }
    }
    r.lastIndex = origIndex;
    return matches;
  }
  function getVar(env, pre, key) {
    var r = typeof env === "function" ? env(key) : env[key];
    if (typeof r === "undefined" && key != "") {
      r = "";
    } else if (typeof r === "undefined") {
      r = "$";
    }
    if (typeof r === "object") {
      return pre + TOKEN + JSON.stringify(r) + TOKEN;
    }
    return pre + r;
  }
  function parseInternal(string, env, opts) {
    if (!opts) {
      opts = {};
    }
    var BS = opts.escape || "\\";
    var BAREWORD = "(\\" + BS + `['"` + META + `]|[^\\s'"` + META + "])+";
    var chunker = new RegExp([
      "(" + CONTROL + ")",
      // control chars
      "(" + BAREWORD + "|" + SINGLE_QUOTE + "|" + DOUBLE_QUOTE + ")+"
    ].join("|"), "g");
    var matches = matchAll(string, chunker);
    if (matches.length === 0) {
      return [];
    }
    if (!env) {
      env = {};
    }
    var commented = false;
    return matches.map(function(match) {
      var s = match[0];
      if (!s || commented) {
        return void 0;
      }
      if (controlRE.test(s)) {
        return { op: s };
      }
      var quote2 = false;
      var esc = false;
      var out = "";
      var isGlob = false;
      var i2;
      function parseEnvVar() {
        i2 += 1;
        var varend;
        var varname;
        var char = s.charAt(i2);
        if (char === "{") {
          i2 += 1;
          if (s.charAt(i2) === "}") {
            throw new Error("Bad substitution: " + s.slice(i2 - 2, i2 + 1));
          }
          varend = s.indexOf("}", i2);
          if (varend < 0) {
            throw new Error("Bad substitution: " + s.slice(i2));
          }
          varname = s.slice(i2, varend);
          i2 = varend;
        } else if (/[*@#?$!_-]/.test(char)) {
          varname = char;
          i2 += 1;
        } else {
          var slicedFromI = s.slice(i2);
          varend = slicedFromI.match(/[^\w\d_]/);
          if (!varend) {
            varname = slicedFromI;
            i2 = s.length;
          } else {
            varname = slicedFromI.slice(0, varend.index);
            i2 += varend.index - 1;
          }
        }
        return getVar(env, "", varname);
      }
      for (i2 = 0; i2 < s.length; i2++) {
        var c = s.charAt(i2);
        isGlob = isGlob || !quote2 && (c === "*" || c === "?");
        if (esc) {
          out += c;
          esc = false;
        } else if (quote2) {
          if (c === quote2) {
            quote2 = false;
          } else if (quote2 == SQ) {
            out += c;
          } else {
            if (c === BS) {
              i2 += 1;
              c = s.charAt(i2);
              if (c === DQ || c === BS || c === DS) {
                out += c;
              } else {
                out += BS + c;
              }
            } else if (c === DS) {
              out += parseEnvVar();
            } else {
              out += c;
            }
          }
        } else if (c === DQ || c === SQ) {
          quote2 = c;
        } else if (controlRE.test(c)) {
          return { op: s };
        } else if (hash.test(c)) {
          commented = true;
          var commentObj = { comment: string.slice(match.index + i2 + 1) };
          if (out.length) {
            return [out, commentObj];
          }
          return [commentObj];
        } else if (c === BS) {
          esc = true;
        } else if (c === DS) {
          out += parseEnvVar();
        } else {
          out += c;
        }
      }
      if (isGlob) {
        return { op: "glob", pattern: out };
      }
      return out;
    }).reduce(function(prev, arg) {
      return typeof arg === "undefined" ? prev : prev.concat(arg);
    }, []);
  }
  parse = function parse2(s, env, opts) {
    var mapped = parseInternal(s, env, opts);
    if (typeof env !== "function") {
      return mapped;
    }
    return mapped.reduce(function(acc, s2) {
      if (typeof s2 === "object") {
        return acc.concat(s2);
      }
      var xs = s2.split(RegExp("(" + TOKEN + ".*?" + TOKEN + ")", "g"));
      if (xs.length === 1) {
        return acc.concat(xs[0]);
      }
      return acc.concat(xs.filter(Boolean).map(function(x) {
        if (startsWithToken.test(x)) {
          return JSON.parse(x.split(TOKEN)[1]);
        }
        return x;
      }));
    }, []);
  };
  return parse;
}
var hasRequiredShellQuote;
function requireShellQuote() {
  if (hasRequiredShellQuote) return shellQuote;
  hasRequiredShellQuote = 1;
  shellQuote.quote = requireQuote();
  shellQuote.parse = requireParse();
  return shellQuote;
}
var shellQuoteExports = requireShellQuote();
function getBaseRef() {
  const eventName = process.env.GITHUB_EVENT_NAME;
  if (eventName === "pull_request") {
    try {
      const eventPath = process.env.GITHUB_EVENT_PATH;
      if (eventPath) {
        const event = JSON.parse(fs__namespace.readFileSync(eventPath, "utf8"));
        return event.pull_request?.base?.sha || "main";
      }
      return "main";
    } catch {
      return "main";
    }
  }
  return "HEAD~1";
}
function getChangedFiles(baseRef) {
  try {
    const safeBaseRef = shellQuoteExports.quote([baseRef]);
    const commands = [
      `git diff --name-only ${safeBaseRef}...HEAD`,
      `git diff --name-only ${safeBaseRef} HEAD`,
      "git diff --name-only HEAD~1 HEAD"
    ];
    for (const cmd of commands) {
      try {
        const output = node_child_process.execSync(cmd, {
          encoding: "utf8",
          stdio: ["pipe", "pipe", "ignore"]
        });
        const files = output.split("\n").filter((file) => file.trim());
        if (files.length > 0) {
          return files;
        }
      } catch {
      }
    }
    core__namespace.warning("⚠️ Could not determine changed files, assuming all apps may be affected");
    return ["**/*"];
  } catch (error) {
    core__namespace.warning(`⚠️ Git diff failed: ${error instanceof Error ? error.message : String(error)}`);
    return ["**/*"];
  }
}
function setActionOutput(name, value) {
  core__namespace.setOutput(name, value);
  core__namespace.info(`📤 Set output ${name}=${value}`);
}
function setOutputs(changedApps, changedFiles = []) {
  const appNames = changedApps.map((app) => app.name);
  const appPaths = changedApps.map((app) => app.path);
  const hasChanges = changedApps.length > 0;
  const matrix = {
    include: changedApps.map((app) => ({
      name: app.name,
      path: app.path
    }))
  };
  let summary = "";
  if (hasChanges) {
    summary = `${changedApps.length} Fusion app${changedApps.length === 1 ? "" : "s"} changed: ${appNames.join(", ")}`;
  } else {
    summary = "No Fusion apps changed";
  }
  setActionOutput("changed-apps", JSON.stringify(changedApps));
  setActionOutput("changed-app-names", appNames.join(","));
  setActionOutput("changed-app-paths", JSON.stringify(appPaths));
  setActionOutput("changed-files", JSON.stringify(changedFiles));
  setActionOutput("has-changes", hasChanges.toString());
  setActionOutput("summary", summary);
  setActionOutput("app-types", JSON.stringify([]));
  setActionOutput("matrix", JSON.stringify(matrix));
  setActionOutput("changed-apps-count", changedApps.length.toString());
  core__namespace.info(`📋 Summary: ${summary}`);
}
function setErrorOutputs(errorMessage) {
  setActionOutput("changed-apps", "[]");
  setActionOutput("changed-app-names", "");
  setActionOutput("changed-app-paths", "[]");
  setActionOutput("changed-files", "[]");
  setActionOutput("has-changes", "false");
  setActionOutput("summary", errorMessage);
  setActionOutput("app-types", "[]");
  setActionOutput("matrix", JSON.stringify({ include: [] }));
  setActionOutput("changed-apps-count", "0");
}
async function run() {
  try {
    core__namespace.info("🔍 Detecting changed Fusion apps...");
    const appPaths = core__namespace.getInput("app-paths") || "apps/*";
    const baseRef = getBaseRef();
    let appPatterns = [];
    if (appPaths.startsWith("[") && appPaths.endsWith("]")) {
      appPatterns = JSON.parse(appPaths);
    } else {
      appPatterns = [appPaths];
    }
    const changedFiles = getChangedFiles(baseRef);
    const allApps = findFusionApps(appPatterns);
    core__namespace.info(`🎯 Found ${allApps.length} Fusion apps`);
    const changedApps = findChangedApps(changedFiles, allApps);
    setOutputs(changedApps, changedFiles);
    if (changedApps.length > 0) {
      core__namespace.info(
        `📦 ${changedApps.length} apps changed: ${changedApps.map((app) => app.name).join(", ")}`
      );
    } else {
      core__namespace.info("✨ No Fusion apps changed");
    }
    core__namespace.info("✅ Detection completed");
  } catch (error) {
    const errorMessage = `Detection failed: ${error instanceof Error ? error.message : String(error)}`;
    setErrorOutputs(errorMessage);
    core__namespace.setFailed(`❌ ${errorMessage}`);
  }
}
if ((typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("index.js", document.baseURI).href) === `file://${process.argv[1]}`) {
  run().catch((error) => {
    core__namespace.setFailed(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  });
}
exports.findChangedApps = findChangedApps;
exports.findFusionApps = findFusionApps;
exports.getBaseRef = getBaseRef;
exports.getChangedFiles = getChangedFiles;
exports.isFusionApp = isFusionApp;
exports.run = run;
exports.setOutputs = setOutputs;
//# sourceMappingURL=index.js.map

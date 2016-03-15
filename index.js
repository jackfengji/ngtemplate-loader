var loaderUtils = require("loader-utils");
var fs = require('fs');
var path = require('path');
var jsesc = require('jsesc');

module.exports = function (content) {
    this.cacheable && this.cacheable();

    var query = loaderUtils.parseQuery(this.query);
    var modulePrefix = query.modulePrefix || '';
    var relativeTo = query.relativeTo || '';
    var prefix = query.prefix || '';
    var absolute = false;
    var pathSep = query.pathSep || '/';
    var resource = this.resource;
    var pathSepRegex = new RegExp(escapeRegExp(path.sep), 'g');

    // if a unix path starts with // we treat is as an absolute path e.g. //Users/wearymonkey
    // if we're on windows, then we ignore the / prefix as windows absolute paths are unique anyway e.g. C:\Users\wearymonkey
    if (relativeTo[0] == '/') {
        if (path.sep == '\\') { // we're on windows
            relativeTo = relativeTo.substring(1);
        } else if (relativeTo[1] == '/') {
            absolute = true;
            relativeTo = relativeTo.substring(1);
        }
    }

    // normalise the path separators
    if (path.sep != pathSep) {
        relativeTo = relativeTo.replace(pathSepRegex, pathSep);
        prefix = prefix.replace(pathSepRegex, pathSep);
        resource = resource.replace(pathSepRegex, pathSep)
    }

    var relativeToIndex = resource.indexOf(relativeTo);
    if (relativeToIndex === -1 || (absolute && relativeToIndex !== 0)) {
        throw 'The path for file doesn\'t contain relativeTo param';
    }

    var filePath = prefix + resource.slice(relativeToIndex + relativeTo.length); // get the base path
    var html;

    if (content.match(/^module\.exports/)) {
        var firstQuote = findQuote(content, false);
        var secondQuote = findQuote(content, true);
        html = content.substr(firstQuote, secondQuote - firstQuote + 1);
    } else {
        html = content;
    }

    var moduleDir = path.dirname(resource);
    var moduleFile = null;
    while (moduleDir.indexOf(relativeTo) !== -1) {
        fs.readdirSync(moduleDir).forEach(function (filename) {
            if (endsWith(filename, '.module.js')) {
                if (moduleFile) {
                    throw 'Find two modules file in one directory level';
                }

                moduleFile = filename;
            }
        });

        if (moduleFile) {
            break;
        } else {
            moduleDir = path.dirname(moduleDir);
        }
    }

    if (!moduleFile) {
        throw 'No module file found';
    }

    var ngModule = modulePrefix + '.' + path.basename(moduleFile, '.module.js');

    return "var path = '"+jsesc(filePath)+"';\n" +
        "var html = " + html + ";\n" +
        "window.angular.module('" + ngModule + "').run(['$templateCache', function(c) { c.put(path, html) }]);\n" +
        "module.exports = path;";

    function findQuote(content, backwards) {
        var i = backwards ? content.length - 1 : 0;
        while (i >= 0 && i < content.length) {
            if (content[i] == '"' || content[i] == "'") {
                return i;
            }
            i += backwards ? -1 : 1;
        }
        return -1;
    }

    // source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Using_Special_Characters
    function escapeRegExp(string) {
        return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    }

    function endsWith(string, suffix) {
        return string.length >= suffix.length && string.lastIndexOf(suffix) === string.length - suffix.length;
    }
};

"use strict";

var Class = require("./Class");

var Util = exports.Util = Class.extend({

	$serializeArray: function (a) {
		if (a == null)
			return null;
		var ret = [];
		for (var i = 0; i < a.length; ++i)
			ret[i] = a[i].serialize();
		return ret;
	},

	$serializeNullable: function (v) {
		if (v == null)
			return null;
		return v.serialize();
	},

	$repeat: function(c, n) {
		var s = "";
		for(var i = 0; i < n; ++i) {
			s += c;
		}
		return s;
	},

	// Usage: format("%1 %% %2", ["foo", "bar"]) -> "foo % bar"
	$format: function(fmt, args) {
		if(!(args instanceof Array)) {
			throw new Error("args must be an Array");
		}

		var i = 0;
		return fmt.replace(/%(\d+|%)/g, function(s, f) {
			if (f === "%") {
				return "%";
			}
			else {
				return args[parseInt(f) - 1];
			}
		});
	},

	$analyzeArgs: function (context, args) {
		var argTypes = [];
		for (var i = 0; i < args.length; ++i) {
			if (! args[i].analyze(context))
				return null;
			argTypes[i] = args[i].getType();
		}
		return argTypes;
	},

	$typesAreEqual : function (x, y) {
		if (x.length != y.length)
			return false;
		for (var i = 0; i < x.length; ++i)
			if (! x[i].equals(y))
				return false;
		return true;
	},

	$decodeStringLiteral: function (literal) {
		var matched = literal.match(/^([\'\"]).*([\'\"])$/);
		if (matched == null || matched[1] != matched[2])
			throw new Error("input string is not quoted properly: " + literal);
		var src = literal.substring(1, literal.length - 1);
		var decoded = "";
		var pos = 0, backslashAt;
		while ((backslashAt = src.indexOf("\\", pos)) != -1) {
			// copy the string before backslash
			decoded += src.substring(pos, backslashAt);
			pos = backslashAt + 1;
			// decode
			if (pos == src.length)
				throw new Error("last character within a string literal cannot be a backslash: " + literal);
			var escapeChar = src.charAt(pos++);
			switch (escapeChar) {
			case "'":
			case "\"":
			case "\\":
				decoded += escapeChar;
				break;
			case "b": decoded += "\b"; break;
			case "f": decoded += "\f"; break;
			case "n": decoded += "\n"; break;
			case "r": decoded += "\r"; break;
			case "t": decoded += "\t"; break;
			case "v": decoded += "\v"; break;
			case "u":
				var matched = src.substring(pos).match(/^([0-9A-Fa-f]{4})/);
				if (matched == null)
					throw new Error("expected four hexdigits after \\u: " + literal);
				decoded += String.fromCharCode(parseInt(matched[1], 16));
				pos += 4;
				break;
			case "0":
				if (pos == src.length || src.charAt(pos).match(/[0-9]/) == null)
					decoded += "\0";
				else
					throw new Error("found a digit after '\\0': " + literal);
				break;
			}
		}
		decoded += src.substring(pos);
		return decoded;
	},

	$resolvePath: function (path) {
		var tokens = path.split("/");
		for (var i = 0; i < tokens.length;) {
			if (tokens[i] == ".") {
				tokens.splice(i, 1);
			} else if (tokens[i] == ".." && i != 0 && tokens[i - 1] != "..") {
				if (i == 1 && tokens[0] == "") {
					tokens.splice(i, 1);
				} else {
					tokens.splice(i - 1, 2);
					i -= 1;
				}
			} else {
				i++;
			}
		}
		return tokens.join("/");
	}

});

var TemplateInstantiationRequest = exports.TemplateInstantiationRequest = Class.extend({

	initialize: function (token, className, typeArgs) {
		this._token = token;
		this._className = className;
		this._typeArgs = typeArgs;
	},

	getToken: function() {
		return this._token;
	},

	getClassName: function () {
		return this._className;
	},

	getTypeArguments: function () {
		return this._typeArgs;
	}

});

var CompileError = exports.CompileError = Class.extend({

	initialize: function () {
		switch (arguments.length) {
		case 2: // token, text
			var token = arguments[0];
			if(token != null) {
				this._filename = token.getFilename();
				this._lineNumber = token.getLineNumber();
				this._columnNumber = token.getColumnNumber();
				// FIXME: deal with visual width
				this._size = token.getValue().length;
				this._message = arguments[1];
			}
			else {
				CompileError.call(this, null, 0, 0, arguments[1]);
				return;
			}
			break;
		case 4: // filename, lineNumber, columnNumber, text
			this._filename = arguments[0];
			this._lineNumber = arguments[1];
			this._columnNumber = arguments[2];
			this._message = arguments[3];
			this._size = 1;
			break;
		default:
			throw new Error("Unrecognized arguments for CompileError: " + JSON.stringify( Array.prototype.slice.call(arguments) ));

		}
		if(!(this._filename == null || typeof(this._filename) === "string"))
			throw new Error("filename is not a string nor null");
		if(typeof(this._lineNumber) !== "number")
			throw new Error("lineNumber is not a number");
		if(typeof(this._columnNumber) !== "number")
			throw new Error("columnNumber is not a number");
	},

	format: function (compiler) {
		if (this._filename == null) {
			return this._message + "\n";
		}
		else if (this._lineNumber === 0) {
			return Util.format("[%1] %2\n", [ this._filename, this._message ]);
		}

		var content = compiler.getFileContent([] /* ignore errors */, null, this._filename);
		var sourceLine = content.split(/^/m)[ this._lineNumber - 1 ];

		// fix visual width
		var col = this._columnNumber;
		var TAB_WIDTH = 4;
		var tabs = sourceLine.slice(0, col).match(/\t/g);
		if(tabs != null) {
			col += (TAB_WIDTH-1) * tabs.length;
		}

		sourceLine  = sourceLine.replace(/\t/g, Util.repeat(" ", TAB_WIDTH));
		sourceLine += Util.repeat(" ", col);
		sourceLine += Util.repeat("^", this._size);

		return Util.format("[%1:%2] %3\n%4\n",
						   [this._filename, this._lineNumber, this._message, sourceLine]);
	}

});


// vim: set noexpandtab:

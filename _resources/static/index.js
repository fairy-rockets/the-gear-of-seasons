/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "/static/";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./frontend/index.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./frontend/Gear.js":
/*!**************************!*\
  !*** ./frontend/Gear.js ***!
  \**************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
eval("\n\nObject.defineProperty(exports, \"__esModule\", {\n  value: true\n});\n\nvar _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if (\"value\" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();\n\nvar _World = __webpack_require__(/*! ./World */ \"./frontend/World.js\");\n\nvar _World2 = _interopRequireDefault(_World);\n\nfunction _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }\n\nfunction _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError(\"Cannot call a class as a function\"); } }\n\nvar Gear = function () {\n  /**\n   * @param {World} world \n   */\n  function Gear(world) {\n    _classCallCheck(this, Gear);\n\n    this.world_ = world;\n  }\n  /**\n   * \n   * @param {WebGLRenderingContext} gl \n   */\n\n\n  _createClass(Gear, [{\n    key: \"render\",\n    value: function render(gl) {}\n  }]);\n\n  return Gear;\n}();\n\nexports.default = Gear;\n\n//# sourceURL=webpack:///./frontend/Gear.js?");

/***/ }),

/***/ "./frontend/World.js":
/*!***************************!*\
  !*** ./frontend/World.js ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
eval("\n\nObject.defineProperty(exports, \"__esModule\", {\n  value: true\n});\n\nvar _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if (\"value\" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();\n\nvar _Gear = __webpack_require__(/*! ./Gear */ \"./frontend/Gear.js\");\n\nvar _Gear2 = _interopRequireDefault(_Gear);\n\nfunction _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }\n\nfunction _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError(\"Cannot call a class as a function\"); } }\n\nvar World = function () {\n  _createClass(World, null, [{\n    key: \"fromCanvas\",\n\n    /**\n     * \n     * @param {HTMLDivElement} wrapper\n     * @param {HTMLCanvasElement} canvas \n     * @returns {World}\n     */\n    value: function fromCanvas(wrapper, canvas) {\n      var gl = canvas.getContext('webgl');\n      if (!gl) {\n        return null;\n      }\n      return new World(wrapper, canvas, gl);\n    }\n    /**\n     * @param {HTMLDivElement} wrapper\n     * @param {HTMLCanvasElement} canvas \n     * @param {WebGLRenderingContext} gl \n     * @private\n     */\n\n  }]);\n\n  function World(wrapper, canvas, gl) {\n    _classCallCheck(this, World);\n\n    this.wrapper_ = wrapper;\n    this.canvas_ = canvas;\n    this.gl_ = gl;\n    this.runner_ = this.run.bind(this);\n    this.gear_ = new _Gear2.default(this);\n  }\n\n  _createClass(World, [{\n    key: \"start\",\n    value: function start() {\n      this.init_();\n      requestAnimationFrame(this.runner_);\n    }\n  }, {\n    key: \"init_\",\n    value: function init_() {}\n    /**\n     * @param {number} time \n     */\n\n  }, {\n    key: \"run\",\n    value: function run(time) {\n      requestAnimationFrame(this.runner_);\n      var gl = this.gl_;\n      this.canvas_.width = this.wrapper_.clientWidth;\n      this.canvas_.height = this.wrapper_.clientHeight;\n      // canvasを初期化する色を設定する\n      gl.clearColor(0.0, 0.0, 0.0, 1.0);\n      // canvasを初期化する際の深度を設定する\n      gl.clearDepth(1.0);\n      // canvasを初期化\n      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);\n\n      this.gear_.render(gl);\n\n      gl.flush();\n    }\n  }]);\n\n  return World;\n}();\n\nexports.default = World;\n\n//# sourceURL=webpack:///./frontend/World.js?");

/***/ }),

/***/ "./frontend/index.js":
/*!***************************!*\
  !*** ./frontend/index.js ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
eval("\n\nvar _Gear = __webpack_require__(/*! ./Gear */ \"./frontend/Gear.js\");\n\nvar _Gear2 = _interopRequireDefault(_Gear);\n\nvar _World = __webpack_require__(/*! ./World */ \"./frontend/World.js\");\n\nvar _World2 = _interopRequireDefault(_World);\n\nfunction _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }\n\n/** @type {World} */\nvar world = null;\n\nfunction main() {\n  /** @type {HTMLCanvasElement} */\n  var wrapper = document.getElementById('background_wrapper');\n  var canvas = document.getElementById('background');\n  if (!canvas || !wrapper) {\n    document.body.innerHTML = '<h1>No canvas</h1>';\n    return;\n  }\n  world = _World2.default.fromCanvas(wrapper, canvas);\n  if (!world) {\n    document.body.innerHTML = '<h1>WebGL not supported</h1>';\n    return;\n  }\n  world.start();\n}\n\ndocument.addEventListener('DOMContentLoaded', function () {\n  main();\n});\n\n//# sourceURL=webpack:///./frontend/index.js?");

/***/ })

/******/ });
var assert = require('chai').assert;
var expect = require('chai').expect;
var Terminal = require('../xterm');

describe('xterm.js', function() {
  var xterm;

  beforeEach(function () {
    xterm = new Terminal();
    xterm.refresh = function(){};
    xterm.viewport = {
      syncScrollArea: function(){}
    };
    xterm.compositionHelper = {
      keydown: function(){ return true; }
    };
    // Force synchronous writes
    xterm.write = function(data) {
      xterm.writeBuffer.push(data);
      xterm.innerWrite();
    };
    xterm.element = {
      classList: {
        toggle: function(){},
        remove: function(){},
        add: function () {}
      }
    };
    xterm.selectionManager = {
      disable: function () {},
      enable: function () {},
      setBuffer: function (buffer) {}
    };
  });

  describe('getOption', function() {
    it('should retrieve the option correctly', function() {
      // In the `options` namespace.
      xterm.options.cursorBlink = true;
      assert.equal(xterm.getOption('cursorBlink'), true);

      // On the Terminal instance
      delete xterm.options.cursorBlink;
      xterm.cursorBlink = false;
      assert.equal(xterm.getOption('cursorBlink'), false);
    });
    it('should throw when retrieving a non-existant option', function() {
      assert.throws(xterm.getOption.bind(xterm, 'fake', true));
    });
  });

  describe('setOption', function() {
    it('should set the option correctly', function() {
      xterm.setOption('cursorBlink', true);
      assert.equal(xterm.cursorBlink, true);
      assert.equal(xterm.options.cursorBlink, true);
      xterm.setOption('cursorBlink', false);
      assert.equal(xterm.cursorBlink, false);
      assert.equal(xterm.options.cursorBlink, false);
    });
    it('should throw when setting a non-existant option', function() {
      assert.throws(xterm.setOption.bind(xterm, 'fake', true));
    });
    it('should not allow scrollback less than number of rows', function() {
      let setOptionCall = xterm.setOption.bind(xterm, 'scrollback', xterm.rows - 1);

      assert.equal(setOptionCall(), false);
    });
  });

  describe('clear', function() {
    it('should clear a buffer equal to rows', function() {
      var promptLine = xterm.buffer.lines.get(xterm.buffer.ybase + xterm.buffer.y);
      xterm.clear();
      assert.equal(xterm.buffer.y, 0);
      assert.equal(xterm.buffer.ybase, 0);
      assert.equal(xterm.buffer.ydisp, 0);
      assert.equal(xterm.buffer.lines.length, xterm.rows);
      assert.deepEqual(xterm.buffer.lines.get(0), promptLine);
      for (var i = 1; i < xterm.rows; i++) {
        assert.deepEqual(xterm.buffer.lines.get(i), xterm.blankLine());
      }
    });
    it('should clear a buffer larger than rows', function() {
      // Fill the buffer with dummy rows
      for (var i = 0; i < xterm.rows * 2; i++) {
        xterm.write('test\n');
      }

      var promptLine = xterm.buffer.lines.get(xterm.buffer.ybase + xterm.buffer.y);
      xterm.clear();
      assert.equal(xterm.buffer.y, 0);
      assert.equal(xterm.buffer.ybase, 0);
      assert.equal(xterm.buffer.ydisp, 0);
      assert.equal(xterm.buffer.lines.length, xterm.rows);
      assert.deepEqual(xterm.buffer.lines.get(0), promptLine);
      for (var i = 1; i < xterm.rows; i++) {
        assert.deepEqual(xterm.buffer.lines.get(i), xterm.blankLine());
      }
    });
    it('should not break the prompt when cleared twice', function() {
      var promptLine = xterm.buffer.lines.get(xterm.buffer.ybase + xterm.buffer.y);
      xterm.clear();
      xterm.clear();
      assert.equal(xterm.buffer.y, 0);
      assert.equal(xterm.buffer.ybase, 0);
      assert.equal(xterm.buffer.ydisp, 0);
      assert.equal(xterm.buffer.lines.length, xterm.rows);
      assert.deepEqual(xterm.buffer.lines.get(0), promptLine);
      for (var i = 1; i < xterm.rows; i++) {
        assert.deepEqual(xterm.buffer.lines.get(i), xterm.blankLine());
      }
    });
  });

  describe('scroll', function() {
    describe('scrollDisp', function() {
      var startYDisp;
      beforeEach(function() {
        for (var i = 0; i < xterm.rows * 2; i++) {
          xterm.writeln('test');
        }
        startYDisp = xterm.rows + 1;
      });
      it('should scroll a single line', function() {
        assert.equal(xterm.buffer.ydisp, startYDisp);
        xterm.scrollDisp(-1);
        assert.equal(xterm.buffer.ydisp, startYDisp - 1);
        xterm.scrollDisp(1);
        assert.equal(xterm.buffer.ydisp, startYDisp);
      });
      it('should scroll multiple lines', function() {
        assert.equal(xterm.buffer.ydisp, startYDisp);
        xterm.scrollDisp(-5);
        assert.equal(xterm.buffer.ydisp, startYDisp - 5);
        xterm.scrollDisp(5);
        assert.equal(xterm.buffer.ydisp, startYDisp);
      });
      it('should not scroll beyond the bounds of the buffer', function() {
        assert.equal(xterm.buffer.ydisp, startYDisp);
        xterm.scrollDisp(1);
        assert.equal(xterm.buffer.ydisp, startYDisp);
        for (var i = 0; i < startYDisp; i++) {
          xterm.scrollDisp(-1);
        }
        assert.equal(xterm.buffer.ydisp, 0);
        xterm.scrollDisp(-1);
        assert.equal(xterm.buffer.ydisp, 0);
      });
    });

    describe('scrollPages', function() {
      var startYDisp;
      beforeEach(function() {
        for (var i = 0; i < xterm.rows * 3; i++) {
          xterm.writeln('test');
        }
        startYDisp = (xterm.rows * 2) + 1;
      });
      it('should scroll a single page', function() {
        assert.equal(xterm.buffer.ydisp, startYDisp);
        xterm.scrollPages(-1);
        assert.equal(xterm.buffer.ydisp, startYDisp - (xterm.rows - 1));
        xterm.scrollPages(1);
        assert.equal(xterm.buffer.ydisp, startYDisp);
      });
      it('should scroll a multiple pages', function() {
        assert.equal(xterm.buffer.ydisp, startYDisp);
        xterm.scrollPages(-2);
        assert.equal(xterm.buffer.ydisp, startYDisp - (xterm.rows - 1) * 2);
        xterm.scrollPages(2);
        assert.equal(xterm.buffer.ydisp, startYDisp);
      });
    });

    describe('scrollToTop', function() {
      beforeEach(function() {
        for (var i = 0; i < xterm.rows * 3; i++) {
          xterm.writeln('test');
        }
      });
      it('should scroll to the top', function() {
        assert.notEqual(xterm.buffer.ydisp, 0);
        xterm.scrollToTop();
        assert.equal(xterm.buffer.ydisp, 0);
      });
    });

    describe('scrollToBottom', function() {
      var startYDisp;
      beforeEach(function() {
        for (var i = 0; i < xterm.rows * 3; i++) {
          xterm.writeln('test');
        }
        startYDisp = (xterm.rows * 2) + 1;
      });
      it('should scroll to the bottom', function() {
        xterm.scrollDisp(-1);
        xterm.scrollToBottom();
        assert.equal(xterm.buffer.ydisp, startYDisp);
        xterm.scrollPages(-1);
        xterm.scrollToBottom();
        assert.equal(xterm.buffer.ydisp, startYDisp);
        xterm.scrollToTop();
        xterm.scrollToBottom();
        assert.equal(xterm.buffer.ydisp, startYDisp);
      });
    });

    describe('keyDown', function () {
      it('should scroll down, when a key is pressed and terminal is scrolled up', function () {
        // Override evaluateKeyEscapeSequence to return cancel code
        xterm.evaluateKeyEscapeSequence = function() {
          return { key: 'a' };
        };
        var event = {
          type: 'keydown',
          keyCode: 0,
          preventDefault: function(){},
          stopPropagation: function(){}
        };

        xterm.buffer.ydisp = 0;
        xterm.buffer.ybase = 40;
        assert.notEqual(xterm.buffer.ydisp, xterm.buffer.ybase);
        xterm.keyDown(event);

        // Ensure that now the terminal is scrolled to bottom
        assert.equal(xterm.buffer.ydisp, xterm.buffer.ybase);
      });

      it('should not scroll down, when a custom keydown handler prevents the event', function () {
        // Add some output to the terminal
        for (var i = 0; i < xterm.rows * 3; i++) {
          xterm.writeln('test');
        }
        var startYDisp = (xterm.rows * 2) + 1;
        xterm.attachCustomKeydownHandler(function () {
          return false;
        });

        assert.equal(xterm.buffer.ydisp, startYDisp);
        xterm.scrollDisp(-1);
        assert.equal(xterm.buffer.ydisp, startYDisp - 1);
        xterm.keyDown({ keyCode: 0 });
        assert.equal(xterm.buffer.ydisp, startYDisp - 1);
      });
    });
  });

  describe('evaluateKeyEscapeSequence', function() {
    it('should return the correct escape sequence for unmodified keys', function() {
      // Backspace
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 8 }).key, '\x7f'); // ^?
      // Tab
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 9 }).key, '\t');
      // Return/enter
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 13 }).key, '\r'); // CR
      // Escape
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 27 }).key, '\x1b');
      // Page up, page down
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 33 }).key, '\x1b[5~'); // CSI 5 ~
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 34 }).key, '\x1b[6~'); // CSI 6 ~
      // End, Home
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 35 }).key, '\x1b[F'); // SS3 F
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 36 }).key, '\x1b[H'); // SS3 H
      // Left, up, right, down arrows
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 37 }).key, '\x1b[D'); // CSI D
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 38 }).key, '\x1b[A'); // CSI A
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 39 }).key, '\x1b[C'); // CSI C
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 40 }).key, '\x1b[B'); // CSI B
      // Insert
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 45 }).key, '\x1b[2~'); // CSI 2 ~
      // Delete
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 46 }).key, '\x1b[3~'); // CSI 3 ~
      // F1-F12
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 112 }).key, '\x1bOP'); // SS3 P
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 113 }).key, '\x1bOQ'); // SS3 Q
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 114 }).key, '\x1bOR'); // SS3 R
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 115 }).key, '\x1bOS'); // SS3 S
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 116 }).key, '\x1b[15~'); // CSI 1 5 ~
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 117 }).key, '\x1b[17~'); // CSI 1 7 ~
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 118 }).key, '\x1b[18~'); // CSI 1 8 ~
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 119 }).key, '\x1b[19~'); // CSI 1 9 ~
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 120 }).key, '\x1b[20~'); // CSI 2 0 ~
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 121 }).key, '\x1b[21~'); // CSI 2 1 ~
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 122 }).key, '\x1b[23~'); // CSI 2 3 ~
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 123 }).key, '\x1b[24~'); // CSI 2 4 ~
    });
    it('should return \\x1b[3;5~ for ctrl+delete', function() {
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 46 }).key, '\x1b[3;5~');
    });
    it('should return \\x1b[3;2~ for shift+delete', function() {
      assert.equal(xterm.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 46 }).key, '\x1b[3;2~');
    });
    it('should return \\x1b[3;3~ for alt+delete', function() {
      assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 46 }).key, '\x1b[3;3~');
    });
    it('should return \\x1b[5D for ctrl+left', function() {
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 37 }).key, '\x1b[1;5D'); // CSI 5 D
    });
    it('should return \\x1b[5C for ctrl+right', function() {
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 39 }).key, '\x1b[1;5C'); // CSI 5 C
    });
    it('should return \\x1b[5A for ctrl+up', function() {
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 38 }).key, '\x1b[1;5A'); // CSI 5 A
    });
    it('should return \\x1b[5B for ctrl+down', function() {
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 40 }).key, '\x1b[1;5B'); // CSI 5 B
    });

    describe('On non-macOS platforms', function() {
      beforeEach(function() {
        xterm.browser.isMac = false;
      });
      // Evalueate alt + arrow key movement, which is a feature of terminal emulators but not VT100
      // http://unix.stackexchange.com/a/108106
      it('should return \\x1b[5D for alt+left', function() {
        assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 37 }).key, '\x1b[1;5D'); // CSI 5 D
      });
      it('should return \\x1b[5C for alt+right', function() {
        assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 39 }).key, '\x1b[1;5C'); // CSI 5 C
      });
    });

    describe('On macOS platforms', function() {
      beforeEach(function() {
        xterm.browser.isMac = true;
      });
      it('should return \\x1bb for alt+left', function() {
        assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 37 }).key, '\x1bb'); // CSI 5 D
      });
      it('should return \\x1bf for alt+right', function() {
        assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 39 }).key, '\x1bf'); // CSI 5 C
      });
    });

    it('should return \\x1b[5A for alt+up', function() {
      assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 38 }).key, '\x1b[1;5A'); // CSI 5 A
    });
    it('should return \\x1b[5B for alt+down', function() {
      assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 40 }).key, '\x1b[1;5B'); // CSI 5 B
    });
    it('should return the correct escape sequence for modified F1-F12 keys', function() {
      assert.equal(xterm.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 112 }).key, '\x1b[1;2P');
      assert.equal(xterm.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 113 }).key, '\x1b[1;2Q');
      assert.equal(xterm.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 114 }).key, '\x1b[1;2R');
      assert.equal(xterm.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 115 }).key, '\x1b[1;2S');
      assert.equal(xterm.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 116 }).key, '\x1b[15;2~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 117 }).key, '\x1b[17;2~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 118 }).key, '\x1b[18;2~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 119 }).key, '\x1b[19;2~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 120 }).key, '\x1b[20;2~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 121 }).key, '\x1b[21;2~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 122 }).key, '\x1b[23;2~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 123 }).key, '\x1b[24;2~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 112 }).key, '\x1b[1;3P');
      assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 113 }).key, '\x1b[1;3Q');
      assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 114 }).key, '\x1b[1;3R');
      assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 115 }).key, '\x1b[1;3S');
      assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 116 }).key, '\x1b[15;3~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 117 }).key, '\x1b[17;3~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 118 }).key, '\x1b[18;3~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 119 }).key, '\x1b[19;3~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 120 }).key, '\x1b[20;3~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 121 }).key, '\x1b[21;3~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 122 }).key, '\x1b[23;3~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ altKey: true, keyCode: 123 }).key, '\x1b[24;3~');

      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 112 }).key, '\x1b[1;5P');
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 113 }).key, '\x1b[1;5Q');
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 114 }).key, '\x1b[1;5R');
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 115 }).key, '\x1b[1;5S');
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 116 }).key, '\x1b[15;5~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 117 }).key, '\x1b[17;5~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 118 }).key, '\x1b[18;5~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 119 }).key, '\x1b[19;5~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 120 }).key, '\x1b[20;5~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 121 }).key, '\x1b[21;5~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 122 }).key, '\x1b[23;5~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 123 }).key, '\x1b[24;5~');
    });
  });

  describe('attachCustomKeyEventHandler', function () {
    var evKeyDown = {
      preventDefault: function() {},
      stopPropagation: function() {},
      type: 'keydown'
    }
    var evKeyPress = {
      preventDefault: function() {},
      stopPropagation: function() {},
      type: 'keypress'
    }

    beforeEach(function() {
      xterm.handler = function() {};
      xterm.showCursor = function() {};
      xterm.clearSelection = function() {};
      xterm.compositionHelper = {
        keydown: {
          bind: function() {
            return function () { return true; }
          }
        },
        keypress: {
          bind: function() {
            return function () { return true; }
          }
        }
      }
    });

    it('should process the keydown/keypress event based on what the handler returns', function () {
      assert.equal(xterm.keyDown(Object.assign({}, evKeyDown, { keyCode: 77 })), true);
      assert.equal(xterm.keyPress(Object.assign({}, evKeyPress, { keyCode: 77 })), true);
      xterm.attachCustomKeyEventHandler(function (ev) {
        return ev.keyCode === 77;
      });
      assert.equal(xterm.keyDown(Object.assign({}, evKeyDown, { keyCode: 77 })), true);
      assert.equal(xterm.keyPress(Object.assign({}, evKeyPress, { keyCode: 77 })), true);
      xterm.attachCustomKeyEventHandler(function (ev) {
        return ev.keyCode !== 77;
      });
      assert.equal(xterm.keyDown(Object.assign({}, evKeyDown, { keyCode: 77 })), false);
      assert.equal(xterm.keyPress(Object.assign({}, evKeyPress, { keyCode: 77 })), false);
    });

    it('should alive after reset(ESC c Full Reset (RIS))', function () {
      xterm.attachCustomKeyEventHandler(function (ev) {
        return ev.keyCode !== 77;
      });
      assert.equal(xterm.keyDown(Object.assign({}, evKeyDown, { keyCode: 77 })), false);
      assert.equal(xterm.keyPress(Object.assign({}, evKeyPress, { keyCode: 77 })), false);
      xterm.reset();
      assert.equal(xterm.keyDown(Object.assign({}, evKeyDown, { keyCode: 77 })), false);
      assert.equal(xterm.keyPress(Object.assign({}, evKeyPress, { keyCode: 77 })), false);
    });
  });

  describe('Third level shift', function() {
    var evKeyDown = {
          preventDefault: function() {},
          stopPropagation: function() {},
      		type: 'keydown'
        },
        evKeyPress = {
          preventDefault: function() {},
          stopPropagation: function() {},
      		type: 'keypress'
        };

    beforeEach(function() {
      xterm.handler = function() {};
      xterm.showCursor = function() {};
      xterm.clearSelection = function() {};
      xterm.compositionHelper = {
        isComposing: false,
        keydown: {
          bind: function() {
            return function() { return true; };
          }
        }
      };
    });

    describe('On Mac OS', function() {
      beforeEach(function() {
        xterm.browser.isMac = true;
      });

      it('should not interfere with the alt key on keyDown', function() {
        assert.equal(
          xterm.keyDown(Object.assign({}, evKeyDown, { altKey: true, keyCode: 81 })),
          true
        );
        assert.equal(
          xterm.keyDown(Object.assign({}, evKeyDown, { altKey: true, keyCode: 192 })),
          true
        );
      });

      it('should interefere with the alt + arrow keys', function() {
        assert.equal(
          xterm.keyDown(Object.assign({}, evKeyDown, { altKey: true, keyCode: 37 })),
          false
        );
        assert.equal(
          xterm.keyDown(Object.assign({}, evKeyDown, { altKey: true, keyCode: 39 })),
          false
        );
      });

      it('should emit key with alt + key on keyPress', function(done) {
        var keys = ['@', '@', '\\', '\\', '|', '|'];

        xterm.on('keypress', function(key) {
          if (key) {
            var index = keys.indexOf(key);
            assert(index !== -1, "Emitted wrong key: " + key);
            keys.splice(index, 1);
          }
          if (keys.length === 0) done();
        });

        xterm.keyPress(Object.assign({}, evKeyPress, { altKey: true, keyCode: 64 })); // @
        // Firefox
        xterm.keyPress(Object.assign({}, evKeyPress, { altKey: true, charCode: 64, keyCode: 0 }));
        xterm.keyPress(Object.assign({}, evKeyPress, { altKey: true, keyCode: 92 })); // \
        xterm.keyPress(Object.assign({}, evKeyPress, { altKey: true, charCode: 92, keyCode: 0 }));
        xterm.keyPress(Object.assign({}, evKeyPress, { altKey: true, keyCode: 124 })); // |
        xterm.keyPress(Object.assign({}, evKeyPress, { altKey: true, charCode: 124, keyCode: 0 }));
      });
    });

    describe('On MS Windows', function() {
      beforeEach(function() {
        xterm.browser.isMSWindows = true;
      });

      it('should not interfere with the alt + ctrl key on keyDown', function() {
        assert.equal(
          xterm.keyDown(Object.assign({}, evKeyDown, { altKey: true, ctrlKey: true, keyCode: 81 })),
          true
        );
        assert.equal(
          xterm.keyDown(Object.assign({}, evKeyDown, { altKey: true, ctrlKey: true, keyCode: 192 })),
          true
        );
      });

      it('should interefere with the alt + ctrl + arrow keys', function() {
        assert.equal(
          xterm.keyDown(Object.assign({}, evKeyDown, { altKey: true, ctrlKey: true, keyCode: 37 })),
          false
        );
        assert.equal(
          xterm.keyDown(Object.assign({}, evKeyDown, { altKey: true, ctrlKey: true, keyCode: 39 })),
          false
        );
      });

      it('should emit key with alt + ctrl + key on keyPress', function(done) {
        var keys = ['@', '@', '\\', '\\', '|', '|'];

        xterm.on('keypress', function(key) {
          if (key) {
            var index = keys.indexOf(key);
            assert(index !== -1, "Emitted wrong key: " + key);
            keys.splice(index, 1);
          }
          if (keys.length === 0) done();
        });

        xterm.keyPress(
          Object.assign({}, evKeyPress, { altKey: true, ctrlKey: true, keyCode: 64 })
        ); // @
        xterm.keyPress(
          Object.assign({}, evKeyPress, { altKey: true, ctrlKey: true, charCode: 64, keyCode: 0 })
        );
        xterm.keyPress(
          Object.assign({}, evKeyPress, { altKey: true, ctrlKey: true, keyCode: 92 })
        ); // \
        xterm.keyPress(
          Object.assign({}, evKeyPress, { altKey: true, ctrlKey: true, charCode: 92, keyCode: 0 })
        );
        xterm.keyPress(
          Object.assign({}, evKeyPress, { altKey: true, ctrlKey: true, keyCode: 124 })
        ); // |
        xterm.keyPress(
          Object.assign({}, evKeyPress, { altKey: true, ctrlKey: true, charCode: 124, keyCode: 0 })
        );
      });
    });
  });

  describe('unicode - surrogates', function() {
    it('2 characters per cell', function () {
      this.timeout(10000);  // This is needed because istanbul patches code and slows it down
      var high = String.fromCharCode(0xD800);
      for (var i=0xDC00; i<=0xDCFF; ++i) {
        xterm.write(high + String.fromCharCode(i));
        var tchar = xterm.buffer.lines.get(0)[0];
        expect(tchar[1]).eql(high + String.fromCharCode(i));
        expect(tchar[1].length).eql(2);
        expect(tchar[2]).eql(1);
        expect(xterm.buffer.lines.get(0)[1][1]).eql(' ');
        xterm.reset();
      }
    });
    it('2 characters at last cell', function() {
      var high = String.fromCharCode(0xD800);
      for (var i=0xDC00; i<=0xDCFF; ++i) {
        xterm.buffer.x = xterm.cols - 1;
        xterm.write(high + String.fromCharCode(i));
        expect(xterm.buffer.lines.get(0)[xterm.buffer.x-1][1]).eql(high + String.fromCharCode(i));
        expect(xterm.buffer.lines.get(0)[xterm.buffer.x-1][1].length).eql(2);
        expect(xterm.buffer.lines.get(1)[0][1]).eql(' ');
        xterm.reset();
      }
    });
    it('2 characters per cell over line end with autowrap', function() {
      var high = String.fromCharCode(0xD800);
      for (var i=0xDC00; i<=0xDCFF; ++i) {
        xterm.buffer.x = xterm.cols - 1;
        xterm.wraparoundMode = true;
        xterm.write('a' + high + String.fromCharCode(i));
        expect(xterm.buffer.lines.get(0)[xterm.cols-1][1]).eql('a');
        expect(xterm.buffer.lines.get(1)[0][1]).eql(high + String.fromCharCode(i));
        expect(xterm.buffer.lines.get(1)[0][1].length).eql(2);
        expect(xterm.buffer.lines.get(1)[1][1]).eql(' ');
        xterm.reset();
      }
    });
    it('2 characters per cell over line end without autowrap', function() {
      var high = String.fromCharCode(0xD800);
      for (var i=0xDC00; i<=0xDCFF; ++i) {
        xterm.buffer.x = xterm.cols - 1;
        xterm.wraparoundMode = false;
        xterm.write('a' + high + String.fromCharCode(i));
        // auto wraparound mode should cut off the rest of the line
        expect(xterm.buffer.lines.get(0)[xterm.cols-1][1]).eql('a');
        expect(xterm.buffer.lines.get(0)[xterm.cols-1][1].length).eql(1);
        expect(xterm.buffer.lines.get(1)[1][1]).eql(' ');
        xterm.reset();
      }
    });
    it('splitted surrogates', function() {
      var high = String.fromCharCode(0xD800);
      for (var i=0xDC00; i<=0xDCFF; ++i) {
        xterm.write(high);
        xterm.write(String.fromCharCode(i));
        var tchar = xterm.buffer.lines.get(0)[0];
        expect(tchar[1]).eql(high + String.fromCharCode(i));
        expect(tchar[1].length).eql(2);
        expect(tchar[2]).eql(1);
        expect(xterm.buffer.lines.get(0)[1][1]).eql(' ');
        xterm.reset();
      }
    });
  });

  describe('unicode - combining characters', function() {
    it('café', function () {
      xterm.write('cafe\u0301');
      expect(xterm.buffer.lines.get(0)[3][1]).eql('e\u0301');
      expect(xterm.buffer.lines.get(0)[3][1].length).eql(2);
      expect(xterm.buffer.lines.get(0)[3][2]).eql(1);
    });
    it('café - end of line', function() {
      xterm.buffer.x = xterm.cols - 1 - 3;
      xterm.write('cafe\u0301');
      expect(xterm.buffer.lines.get(0)[xterm.cols-1][1]).eql('e\u0301');
      expect(xterm.buffer.lines.get(0)[xterm.cols-1][1].length).eql(2);
      expect(xterm.buffer.lines.get(0)[xterm.cols-1][2]).eql(1);
      expect(xterm.buffer.lines.get(0)[1][1]).eql(' ');
      expect(xterm.buffer.lines.get(0)[1][1].length).eql(1);
      expect(xterm.buffer.lines.get(0)[1][2]).eql(1);
    });
    it('multiple combined é', function() {
      xterm.wraparoundMode = true;
      xterm.write(Array(100).join('e\u0301'));
      for (var i=0; i<xterm.cols; ++i) {
        var tchar = xterm.buffer.lines.get(0)[i];
        expect(tchar[1]).eql('e\u0301');
        expect(tchar[1].length).eql(2);
        expect(tchar[2]).eql(1);
      }
      tchar = xterm.buffer.lines.get(1)[0];
      expect(tchar[1]).eql('e\u0301');
      expect(tchar[1].length).eql(2);
      expect(tchar[2]).eql(1);
    });
    it('multiple surrogate with combined', function() {
      xterm.wraparoundMode = true;
      xterm.write(Array(100).join('\uD800\uDC00\u0301'));
      for (var i=0; i<xterm.cols; ++i) {
        var tchar = xterm.buffer.lines.get(0)[i];
        expect(tchar[1]).eql('\uD800\uDC00\u0301');
        expect(tchar[1].length).eql(3);
        expect(tchar[2]).eql(1);
      }
      tchar = xterm.buffer.lines.get(1)[0];
      expect(tchar[1]).eql('\uD800\uDC00\u0301');
      expect(tchar[1].length).eql(3);
      expect(tchar[2]).eql(1);
    });
  });

  describe('unicode - fullwidth characters', function() {
    it('cursor movement even', function() {
      expect(xterm.buffer.x).eql(0);
      xterm.write('￥');
      expect(xterm.buffer.x).eql(2);
    });
    it('cursor movement odd', function() {
      xterm.buffer.x = 1;
      expect(xterm.buffer.x).eql(1);
      xterm.write('￥');
      expect(xterm.buffer.x).eql(3);
    });
    it('line of ￥ even', function() {
      xterm.wraparoundMode = true;
      xterm.write(Array(50).join('￥'));
      for (var i=0; i<xterm.cols; ++i) {
        var tchar = xterm.buffer.lines.get(0)[i];
        if (i % 2) {
          expect(tchar[1]).eql('');
          expect(tchar[1].length).eql(0);
          expect(tchar[2]).eql(0);
        } else {
          expect(tchar[1]).eql('￥');
          expect(tchar[1].length).eql(1);
          expect(tchar[2]).eql(2);
        }
      }
      tchar = xterm.buffer.lines.get(1)[0];
      expect(tchar[1]).eql('￥');
      expect(tchar[1].length).eql(1);
      expect(tchar[2]).eql(2);
    });
    it('line of ￥ odd', function() {
      xterm.wraparoundMode = true;
      xterm.buffer.x = 1;
      xterm.write(Array(50).join('￥'));
      for (var i=1; i<xterm.cols-1; ++i) {
        var tchar = xterm.buffer.lines.get(0)[i];
        if (!(i % 2)) {
          expect(tchar[1]).eql('');
          expect(tchar[1].length).eql(0);
          expect(tchar[2]).eql(0);
        } else {
          expect(tchar[1]).eql('￥');
          expect(tchar[1].length).eql(1);
          expect(tchar[2]).eql(2);
        }
      }
      tchar = xterm.buffer.lines.get(0)[xterm.cols-1];
      expect(tchar[1]).eql(' ');
      expect(tchar[1].length).eql(1);
      expect(tchar[2]).eql(1);
      tchar = xterm.buffer.lines.get(1)[0];
      expect(tchar[1]).eql('￥');
      expect(tchar[1].length).eql(1);
      expect(tchar[2]).eql(2);
    });
    it('line of ￥ with combining odd', function() {
      xterm.wraparoundMode = true;
      xterm.buffer.x = 1;
      xterm.write(Array(50).join('￥\u0301'));
      for (var i=1; i<xterm.cols-1; ++i) {
        var tchar = xterm.buffer.lines.get(0)[i];
        if (!(i % 2)) {
          expect(tchar[1]).eql('');
          expect(tchar[1].length).eql(0);
          expect(tchar[2]).eql(0);
        } else {
          expect(tchar[1]).eql('￥\u0301');
          expect(tchar[1].length).eql(2);
          expect(tchar[2]).eql(2);
        }
      }
      tchar = xterm.buffer.lines.get(0)[xterm.cols-1];
      expect(tchar[1]).eql(' ');
      expect(tchar[1].length).eql(1);
      expect(tchar[2]).eql(1);
      tchar = xterm.buffer.lines.get(1)[0];
      expect(tchar[1]).eql('￥\u0301');
      expect(tchar[1].length).eql(2);
      expect(tchar[2]).eql(2);
    });
    it('line of ￥ with combining even', function() {
      xterm.wraparoundMode = true;
      xterm.write(Array(50).join('￥\u0301'));
      for (var i=0; i<xterm.cols; ++i) {
        var tchar = xterm.buffer.lines.get(0)[i];
        if (i % 2) {
          expect(tchar[1]).eql('');
          expect(tchar[1].length).eql(0);
          expect(tchar[2]).eql(0);
        } else {
          expect(tchar[1]).eql('￥\u0301');
          expect(tchar[1].length).eql(2);
          expect(tchar[2]).eql(2);
        }
      }
      tchar = xterm.buffer.lines.get(1)[0];
      expect(tchar[1]).eql('￥\u0301');
      expect(tchar[1].length).eql(2);
      expect(tchar[2]).eql(2);
    });
    it('line of surrogate fullwidth with combining odd', function() {
      xterm.wraparoundMode = true;
      xterm.buffer.x = 1;
      xterm.write(Array(50).join('\ud843\ude6d\u0301'));
      for (var i=1; i<xterm.cols-1; ++i) {
        var tchar = xterm.buffer.lines.get(0)[i];
        if (!(i % 2)) {
          expect(tchar[1]).eql('');
          expect(tchar[1].length).eql(0);
          expect(tchar[2]).eql(0);
        } else {
          expect(tchar[1]).eql('\ud843\ude6d\u0301');
          expect(tchar[1].length).eql(3);
          expect(tchar[2]).eql(2);
        }
      }
    tchar = xterm.buffer.lines.get(0)[xterm.cols-1];
      expect(tchar[1]).eql(' ');
      expect(tchar[1].length).eql(1);
      expect(tchar[2]).eql(1);
      tchar = xterm.buffer.lines.get(1)[0];
      expect(tchar[1]).eql('\ud843\ude6d\u0301');
      expect(tchar[1].length).eql(3);
      expect(tchar[2]).eql(2);
    });
    it('line of surrogate fullwidth with combining even', function() {
      xterm.wraparoundMode = true;
      xterm.write(Array(50).join('\ud843\ude6d\u0301'));
      for (var i=0; i<xterm.cols; ++i) {
        var tchar = xterm.buffer.lines.get(0)[i];
        if (i % 2) {
          expect(tchar[1]).eql('');
          expect(tchar[1].length).eql(0);
          expect(tchar[2]).eql(0);
        } else {
          expect(tchar[1]).eql('\ud843\ude6d\u0301');
          expect(tchar[1].length).eql(3);
          expect(tchar[2]).eql(2);
        }
      }
      tchar = xterm.buffer.lines.get(1)[0];
      expect(tchar[1]).eql('\ud843\ude6d\u0301');
      expect(tchar[1].length).eql(3);
      expect(tchar[2]).eql(2);
    });
  });

  describe('insert mode', function() {
    it('halfwidth - all', function () {
      xterm.write(Array(9).join('0123456789').slice(-80));
      xterm.buffer.x = 10;
      xterm.buffer.y = 0;
      xterm.insertMode = true;
      xterm.write('abcde');
      expect(xterm.buffer.lines.get(0).length).eql(xterm.cols);
      expect(xterm.buffer.lines.get(0)[10][1]).eql('a');
      expect(xterm.buffer.lines.get(0)[14][1]).eql('e');
      expect(xterm.buffer.lines.get(0)[15][1]).eql('0');
      expect(xterm.buffer.lines.get(0)[79][1]).eql('4');
    });
    it('fullwidth - insert', function() {
      xterm.write(Array(9).join('0123456789').slice(-80));
      xterm.buffer.x = 10;
      xterm.buffer.y = 0;
      xterm.insertMode = true;
      xterm.write('￥￥￥');
      expect(xterm.buffer.lines.get(0).length).eql(xterm.cols);
      expect(xterm.buffer.lines.get(0)[10][1]).eql('￥');
      expect(xterm.buffer.lines.get(0)[11][1]).eql('');
      expect(xterm.buffer.lines.get(0)[14][1]).eql('￥');
      expect(xterm.buffer.lines.get(0)[15][1]).eql('');
      expect(xterm.buffer.lines.get(0)[79][1]).eql('3');
    });
    it('fullwidth - right border', function() {
      xterm.write(Array(41).join('￥'));
      xterm.buffer.x = 10;
      xterm.buffer.y = 0;
      xterm.insertMode = true;
      xterm.write('a');
      expect(xterm.buffer.lines.get(0).length).eql(xterm.cols);
      expect(xterm.buffer.lines.get(0)[10][1]).eql('a');
      expect(xterm.buffer.lines.get(0)[11][1]).eql('￥');
      expect(xterm.buffer.lines.get(0)[79][1]).eql(' ');  // fullwidth char got replaced
      xterm.write('b');
      expect(xterm.buffer.lines.get(0).length).eql(xterm.cols);
      expect(xterm.buffer.lines.get(0)[11][1]).eql('b');
      expect(xterm.buffer.lines.get(0)[12][1]).eql('￥');
      expect(xterm.buffer.lines.get(0)[79][1]).eql('');  // empty cell after fullwidth
    });
  });

  describe("switchFromNormalBufferToTheAltBufferAndOtherwise", function() {
    it('switch from normal buffer to the alt and otherwise: ' +
      'use sequence: switch normal to alt -> 1049h; switch alt to normal: -> 1049l', function () {
      assert.equal(xterm.buffer, xterm.buffers.normal);
      assert.equal(xterm.buffers.active, xterm.buffers.normal);
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 0);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 0);

      // render content for normal buffer
      xterm.write("]0;@60617cc44283:/terminal[root@60617cc44283 terminal]# ");
      xterm.write("\r[K[root@60617cc44283 terminal]# ");
      xterm.write("\r\n]0;@60617cc44283:/terminal[root@60617cc44283 terminal]# ");
      xterm.write("\r\n]0;@60617cc44283:/terminal[root@60617cc44283 terminal]# test");

      // save cursor for normal buffer and switch to alt buffer
      xterm.write("\r\n[?1049h");
      assert.equal(xterm.buffer, xterm.buffers.alt);
      assert.equal(xterm.buffers.active, xterm.buffers.alt);
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 0);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      // todo
      xterm.write("[1;10r[4l");

      // move cursor to the new position x = 0, y = 23
      xterm.write("[24;1H");
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 23);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      xterm.write("\r[K\r");

      // switch to normal buffer and restore cursor position for normal buffer
      xterm.write("[?1049l");
      assert.equal(xterm.buffers.active, xterm.buffers.normal);
      assert.equal(xterm.buffer, xterm.buffers.normal);
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 23);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      // set up mouse params
      xterm.write("[?1001s[?1002h[?1006h[?2004h");

      // save cursor position and switch to alt buffer
      xterm.write("[?1049h");
      assert.equal(xterm.buffer, xterm.buffers.alt);
      assert.equal(xterm.buffers.active, xterm.buffers.alt);
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 23);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      // set cursor position in the middle of the screen
      xterm.write("[12;35H");
      assert.equal(xterm.buffers.alt.x, 34);
      assert.equal(xterm.buffers.alt.y, 11);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      // write text on the colored background. Notice: '(B'- Set United States G0 character set
      console.log(xterm.buffer.lines.length);
      xterm.write("(B[30m[46m test");
      assert.equal(getTextFromLine(xterm.buffer.lines, 11), "                                   test                                        ");

      // apply mouse params and set new cursor position
      xterm.write("[?1006l[?1002l[?1001r[?2004l");
      xterm.write("[1;1H");
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 0);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      // Bellow we clean up alt buffer and go back to the normal buffer.
      // All lines of the normal buffer should not be lost and cursor state should be restored.
      // Notice: '[K' - delete line
      xterm.write("[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      // set cursor position on the begin of the buffer
      xterm.write("[1;34H");
      assert.equal(xterm.buffers.alt.x, 33);
      assert.equal(xterm.buffers.alt.y, 0);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      xterm.write("[?1l>");
      // set cursor position on the end of the buffer
      xterm.write("[24;1H");
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 23);
      assert.equal(xterm.buffers.normal.x,0);
      assert.equal(xterm.buffers.normal.y, 3);

      xterm.write("(B[m[39;49m");
      xterm.write("\r[K");

      //switch to normal buffer
      xterm.write("\r[?1049l");
      assert.equal(xterm.buffer, xterm.buffers.normal);
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 23);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      xterm.write("\r\n[root@60617cc44283 terminal#] ");
      assert.equal(xterm.buffer.x, 30);
      assert.equal(xterm.buffer.y, 4);
      assert.equal(getTextFromLine(xterm.buffer.lines, 0), "[root@60617cc44283 terminal]#                                                  ");
      assert.equal(getTextFromLine(xterm.buffer.lines, 1), "[root@60617cc44283 terminal]#                                                  ");
      assert.equal(getTextFromLine(xterm.buffer.lines, 2), "[root@60617cc44283 terminal]# test                                             ");
      assert.equal(getTextFromLine(xterm.buffer.lines, 3), "                                                                               ");
      assert.equal(getTextFromLine(xterm.buffer.lines, 4), "[root@60617cc44283 terminal#]                                                  ");
    });

    it('switch from normal buffer to the alt and otherwise: ' +
      'use sequence: switch normal to alt -> 7 + 47h; switch alt to normal: -> 47l + 8', function () {
      assert.equal(xterm.buffer, xterm.buffers.normal);
      assert.equal(xterm.buffers.active, xterm.buffers.normal);
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 0);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 0);

      // render content for normal buffer
      xterm.write("]0;root@2e5435072925: /terminalroot@2e5435072925:/terminal# ");
      xterm.write("\r[K]0;root@2e5435072925: /terminalroot@2e5435072925:/terminal# ");
      xterm.write("\r\n]0;root@2e5435072925: /terminalroot@2e5435072925:/terminal# ");
      xterm.write("\r\n]0;root@2e5435072925: /terminalroot@2e5435072925:/terminal# test");

      // save cursor for normal buffer and switch to alt buffer
      xterm.write("\r\n7[?47h");
      assert.equal(xterm.buffer, xterm.buffers.alt);
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 0);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      // todo
      xterm.write("[1;10r[4l");

      // move cursor to the new position x = 0, y = 23
      xterm.write("[24;1H");
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 23);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      xterm.write("\r[K\r");

      // switch to normal buffer "[?47" and restore cursor position "8" for normal buffer
      xterm.write("[?47l8");
      assert.equal(xterm.buffers.active, xterm.buffers.normal);
      assert.equal(xterm.buffer, xterm.buffers.normal);
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 23);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      //set up mouse params
      xterm.write("[?1001s[?1002h[?1006h[?2004h");

      // save cursor position "7" and switch to alt buffer "[?47h"
      xterm.write("7[?47h");
      assert.equal(xterm.buffer, xterm.buffers.alt);
      assert.equal(xterm.buffers.active, xterm.buffers.alt);
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 23);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      // set cursor position in the middle of the screen
      xterm.write("[12;35H");
      assert.equal(xterm.buffers.alt.x, 34);
      assert.equal(xterm.buffers.alt.y, 11);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      //write text on the colored background. Notice: '(B'- Set United States G0 character set
      xterm.write("[30m[46m test");
      assert.equal(getTextFromLine(xterm.buffer.lines, 11), "                                   test                                        ");

      // apply mouse params and set new cursor position
      xterm.write("[?1006l[?1002l[?1001r[?2004l");//set up mouse params
      xterm.write("[1;1H");
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 0);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      // Bellow we clean up alt buffer and go back to the normal buffer.
      // All lines of the normal buffer should not be lost and cursor state should be restored.
      // Notice: '[K' - delete line
      xterm.write("[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("[1;34H");
      assert.equal(xterm.buffers.alt.x, 33);
      assert.equal(xterm.buffers.alt.y, 0);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      xterm.write("[?1l>");
      xterm.write("[24;1H");
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 23);
      assert.equal(xterm.buffers.normal.x,0);
      assert.equal(xterm.buffers.normal.y, 3);

      xterm.write("(B[m[39;49m");
      xterm.write("\r[K\r");

      //switch to normal buffer "[?47l" and restore cursor position "8"
      xterm.write("[?47l8");
      assert.equal(xterm.buffer, xterm.buffers.normal);
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 23);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      xterm.write("\r\nroot@2e5435072925:/terminal# ");

      assert.equal(xterm.buffer.x, 29);
      assert.equal(xterm.buffer.y, 4);

      assert.equal(getTextFromLine(xterm.buffer.lines, 0), "root@2e5435072925:/terminal#                                                   ");
      assert.equal(getTextFromLine(xterm.buffer.lines, 1), "root@2e5435072925:/terminal#                                                   ");
      assert.equal(getTextFromLine(xterm.buffer.lines, 2), "root@2e5435072925:/terminal# test                                              ");
      assert.equal(getTextFromLine(xterm.buffer.lines, 3), "                                                                               ");
      assert.equal(getTextFromLine(xterm.buffer.lines, 4), "root@2e5435072925:/terminal#                                                   ");
    });

    // "Mix" control sequences: 7 + 47h and 1049h; 47l + 8 and 1049l
    it('switch from normal buffer to the alt and otherwise: ' +
      'use sequence: switch normal to alt -> 7 + 47h and 1049h too; switch alt to normal: -> 47l + 8 and 1049l too', function () {
      assert.equal(xterm.buffer, xterm.buffers.normal);
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 0);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 0);

      // render content for normal buffer
      xterm.write("]0;root@2e5435072925: /terminalroot@2e5435072925:/terminal# ");
      xterm.write("\r[K]0;root@2e5435072925: /terminalroot@2e5435072925:/terminal# ");
      xterm.write("\r\n]0;root@2e5435072925: /terminalroot@2e5435072925:/terminal# ");
      xterm.write("\r\n]0;root@2e5435072925: /terminalroot@2e5435072925:/terminal# test");

      // save cursor for normal buffer and switch to alternative buffer
      xterm.write("\r\n[?1049h");
      assert.equal(xterm.buffer, xterm.buffers.alt);
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 0);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      // todo
      xterm.write("[1;10r[4l");

      // move cursor to the new position x = 0, y = 23
      xterm.write("[24;1H");
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 23);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      xterm.write("\r[K\r");

      //switch to normal buffer and restore cursor position for normal buffer
      xterm.write("[?1049l");
      assert.equal(xterm.buffer, xterm.buffers.normal);
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 23);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      // set up mouse params
      xterm.write("[?1001s[?1002h[?1006h[?2004h");

      //save cursor '7' and switch to alternative buffer '[?47h'
      assert.equal(xterm.buffer, xterm.buffers.normal);
      xterm.write("7[?47h");
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 23);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      //set up mouse params
      xterm.write("[?1001s[?1002h[?1006h[?2004h");

      //"control shot" - duplicated command to switch to alternative buffer, analog previous combination 7[?47h
      xterm.write("[?1049h");
      assert.equal(xterm.buffer, xterm.buffers.alt);
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 23);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      // set cursor position in the middle of the screen
      xterm.write("[12;35H");
      assert.equal(xterm.buffers.alt.x, 34);
      assert.equal(xterm.buffers.alt.y, 11);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      //write text on the colored background
      xterm.write("[30m[46m test");
      assert.equal(getTextFromLine(xterm.buffer.lines, 11), "                                   test                                        ");

      // apply mouse params and set new cursor position
      xterm.write("[?1006l[?1002l[?1001r[?2004l");//set up mouse params
      xterm.write("[1;1H");
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 0);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      // Bellow we clean up alt buffer and go back to the normal buffer.
      // All lines of the normal buffer should not be lost and cursor state should be restored.
      // Notice: '[K' - delete line
      xterm.write("[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      xterm.write("\n[K");
      // set cursor position on the begin of the buffer
      xterm.write("[1;34H");
      assert.equal(xterm.buffers.alt.x, 33);
      assert.equal(xterm.buffers.alt.y, 0);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      xterm.write("[?1l>");
      // set cursor position on the end of the buffer
      xterm.write("[24;1H");
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 23);
      assert.equal(xterm.buffers.normal.x,0);
      assert.equal(xterm.buffers.normal.y, 3);

      xterm.write("(B[m[39;49m");
      xterm.write("\r[K\r");

      //switch to normal buffer
      xterm.write("[?1049l");
      assert.equal(xterm.buffer, xterm.buffers.normal);

      //"control shot" - duplicated command to switch to normal buffer, analog previous combination [?1049l
      xterm.write("[?47l8");
      assert.equal(xterm.buffer, xterm.buffers.normal);
      assert.equal(xterm.buffers.alt.x, 0);
      assert.equal(xterm.buffers.alt.y, 23);
      assert.equal(xterm.buffers.normal.x, 0);
      assert.equal(xterm.buffers.normal.y, 3);

      xterm.write("\r\nroot@2e5435072925:/terminal# ");

      assert.equal(xterm.buffer.x, 29);
      assert.equal(xterm.buffer.y, 4);

      assert.equal(getTextFromLine(xterm.buffer.lines, 0), "root@2e5435072925:/terminal#                                                   ");
      assert.equal(getTextFromLine(xterm.buffer.lines, 1), "root@2e5435072925:/terminal#                                                   ");
      assert.equal(getTextFromLine(xterm.buffer.lines, 2), "root@2e5435072925:/terminal# test                                              ");
      assert.equal(getTextFromLine(xterm.buffer.lines, 3), "                                                                               ");
      assert.equal(getTextFromLine(xterm.buffer.lines, 4), "root@2e5435072925:/terminal#                                                   ");
    });
  });

  function getTextFromLine(lines, lineNumber) {
    var text = "";
    for (var i = 0; i < lines.get(lineNumber).length - 1; i++) {
      text += lines.get(lineNumber)[i][1];
    }
    // console.log("*" + text);
    return text;
  }
});

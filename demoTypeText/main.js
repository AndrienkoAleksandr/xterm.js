var term,
    socket;

Split(['#left', '#right'], {
  direction: 'horizontal',
  sizes: [50, 50],
  minSize: 1
});

Split(['#top', '#bottom'], {
  direction: 'vertical',
  sizes: [50, 50],
  minSize: 1
});

var terminalContainer = document.getElementById('terminal-container'),
    verticalResizer = document.getElementsByClassName('gutter gutter-vertical')[0],
    horizontalResizer = document.getElementsByClassName('gutter gutter-horizontal')[0],
    rightPanel = document.getElementById("right"),
    actionElements = {
      findNext: document.querySelector('#find-next'),
      findPrevious: document.querySelector('#find-previous')
    },
    optionElements = {
      cursorBlink: document.querySelector('#option-cursor-blink'),
      cursorStyle: document.querySelector('#option-cursor-style'),
      scrollback: document.querySelector('#option-scrollback'),
      tabstopwidth: document.querySelector('#option-tabstopwidth')
    };

actionElements.findNext.addEventListener('keypress', function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    term.findNext(actionElements.findNext.value);
  }
});
actionElements.findPrevious.addEventListener('keypress', function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    term.findPrevious(actionElements.findPrevious.value);
  }
});

optionElements.cursorBlink.addEventListener('change', function () {
  term.setOption('cursorBlink', optionElements.cursorBlink.checked);
});
optionElements.cursorStyle.addEventListener('change', function () {
  term.setOption('cursorStyle', optionElements.cursorStyle.value);
});
optionElements.scrollback.addEventListener('change', function () {
  term.setOption('scrollback', parseInt(optionElements.scrollback.value, 10));
});
optionElements.tabstopwidth.addEventListener('change', function () {
  term.setOption('tabStopWidth', parseInt(optionElements.tabstopwidth.value, 10));
});

function resize() {
  verticalResizer.addEventListener('mousedown', initResize, false);
  horizontalResizer.addEventListener('mousedown', initResize, false);

  function initResize(e) {
    window.addEventListener('mousemove', Resize, false);
    window.addEventListener('mouseup', stopResize, false);
  }

  function Resize(e) {
    terminalContainer.style.width = terminalContainer.parentNode.parentElement.width;
    terminalContainer.style.height = terminalContainer.parentNode.parentElement.height;
    console.log(terminalContainer.style.width);
    resizeTerminal();
  }

  function stopResize(e) {
    window.removeEventListener('mousemove', Resize, false);
    window.removeEventListener('mouseup', stopResize, false);
  }
}
createTerminal();
resize();

function resizeTerminal() {
  var initialGeometry = term.proposeGeometry(),
    cols = initialGeometry.cols,
    rows = initialGeometry.rows;
  term.resize(cols, rows);
}

function createTerminal() {
  // Clean terminal
  while (terminalContainer.children.length) {
    terminalContainer.removeChild(terminalContainer.children[0]);
  }
  term = new Terminal({
    cursorBlink: optionElements.cursorBlink.checked,
    scrollback: parseInt(optionElements.scrollback.value, 10),
    tabStopWidth: parseInt(optionElements.tabstopwidth.value, 10)
  });

  term.open(terminalContainer);
  term.fit();

  var initialGeometry = term.proposeGeometry(),
      cols = initialGeometry.cols,
      rows = initialGeometry.rows;

  // runFakeTerminal();

  // render content for normal buffer
  term.write("]0;@60617cc44283:/terminal[root@60617cc44283 terminal]# ");
  term.write("\r[K[root@60617cc44283 terminal]# ");
  term.write("\r\n]0;@60617cc44283:/terminal[root@60617cc44283 terminal]# ");
  term.write("\r\n]0;@60617cc44283:/terminal[root@60617cc44283 terminal]# test");

  // save cursor for normal buffer and switch to alt buffer
  term.write("\r\n[?1049h");

  // move cursor to the new position x = 0, y = 23
   term.write("[24;1H");

  // switch to normal buffer and restore cursor position for normal buffer
  term.write("[?1049l");

  // save cursor position and switch to alt buffer
  term.write("[?1049h");

  //set cursor position in the middle of the screen
  term.write("[12;35H");

  //write text on the colored background. Notice: '(B'- Set United States G0 character set
  term.write("(B[30m[46m test");

  term.write("[1;1H");

  // Bellow we clean up alt buffer and go back to the normal buffer.
  // All lines of the normal buffer should not be lost and cursor state should be restored.
  // Notice: '[K' - delete line
  // term.write("[K");
  // term.write("\n[K");
  // term.write("\n[K");
  // term.write("\n[K");
  // term.write("\n[K");
  // term.write("\n[K");
  // term.write("\n[K");
  // term.write("\n[K");
  // term.write("\n[K");
  // set cursor position on the begin of the buffer
  // term.write("[1;34H");

  // set cursor position on the end of the buffer
  // term.write("[24;1H");

  // term.write("(B[m[39;49m");
  // term.write("\r[K");

  //switch to normal buffer
  // term.write("\r[?1049l");

  // term.write("\r\n[root@60617cc44283 terminal#] ");
};

function runFakeTerminal() {
  if (term._initialized) {
    return;
  }

  term._initialized = true;

  var shellprompt = '$ ';

  term.prompt = function () {
    term.write('\r\n' + shellprompt);
  };

  term.writeln('Welcome to term.js');
  term.writeln('This is a local terminal emulation, without a real terminal in the back-end.');
  term.writeln('Type some keys and commands to play around.');
  term.writeln('');
  term.prompt();

  term.on('key', function (key, ev) {
    var printable = (
      !ev.altKey && !ev.altGraphKey && !ev.ctrlKey && !ev.metaKey
    );

    if (ev.keyCode === 13) {
      term.prompt();
    } else if (ev.keyCode === 8) {
     // Do not delete the prompt
      if (term.x > 2) {
        term.write('\b \b');
      }
    } else if (printable) {
      term.write(key);
    }
  });

  term.on('paste', function (data, ev) {
    term.write(data);
  });
}

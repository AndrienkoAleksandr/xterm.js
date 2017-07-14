var term,
    protocol,
    socketURL,
    socket,
    pid,
    charWidth,
    charHeight;

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
    optionElements = {
      cursorBlink: document.querySelector('#option-cursor-blink'),
      cursorStyle: document.querySelector('#option-cursor-style'),
      scrollback: document.querySelector('#option-scrollback'),
      tabstopwidth: document.querySelector('#option-tabstopwidth')
    };

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
resize();

function resizeTerminal() {
  var initialGeometry = term.proposeGeometry(),
    cols = initialGeometry.cols,
    rows = initialGeometry.rows;
  term.resize(cols, rows);
}

createTerminal();

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

  createTerminalInfoTools(term, rightPanel);

  term.on('resize', function (size) {
    if (!pid) {
      return;
    }
    var cols = size.cols,
        rows = size.rows,
        url = '/terminals/' + pid + '/size?cols=' + cols + '&rows=' + rows;

    fetch(url, {method: 'POST'});
  });
  protocol = (location.protocol === 'https:') ? 'wss://' : 'ws://';
  socketURL = protocol + location.hostname + ((location.port) ? (':' + location.port) : '') + '/terminals/';

  term.open(terminalContainer);
  term.fit();

  var initialGeometry = term.proposeGeometry(),
      cols = initialGeometry.cols,
      rows = initialGeometry.rows;

  fetch('/terminals?cols=' + cols + '&rows=' + rows, {method: 'POST'}).then(function (res) {

    res.text().then(function (pid) {
      window.pid = pid;
      socketURL += pid;
      socket = new WebSocket(socketURL);
      socket.onopen = runRealTerminal;
      socket.onclose = runFakeTerminal;
      socket.onerror = runFakeTerminal;
    });
  });
}

function runRealTerminal() {
  term.attach(socket);
  term._initialized = true;
}

function runFakeTerminal() {
  if (term._initialized) {
    return;
  }

  term._initialized = true;

  var shellprompt = '$ ';

  term.prompt = function () {
    term.write('\r\n' + shellprompt);
  };

  term.writeln('Welcome to xterm.js');
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

function createTerminalInfoTools(terminal, panel) {
  var rowsElem = createDisplayElement("Amount of rows:", function (ev) {
    terminal.rows = this.value;
  });
  panel.appendChild(rowsElem.view);

  var colsElem = createDisplayElement("Amount of cols:", function (ev) {
    terminal.cols = this.value;
  });
  panel.appendChild(colsElem.view);

  var ydispElem = createDisplayElement("Ydisp:", function (ev) {
    terminal.buffer.ydisp = this.value;
  });
  panel.appendChild(ydispElem.view);

  var yBaseElem = createDisplayElement("Ybase:", function (ev) {
    terminal.buffer.ybase = this.value;
  });
  panel.appendChild(yBaseElem.view);

  var scrollTopElem = createDisplayElement("ScrollTop:", function (ev) {
    terminal.buffer.scrollTop = this.value;
  });
  panel.appendChild(scrollTopElem.view);

  var scrollBottomElem = createDisplayElement("ScrollBottom:", function (ev) {
    terminal.buffer.scrollBottom = this.value;
  });
  panel.appendChild(scrollBottomElem.view);

  var xElem = createDisplayElement("X:", function (ev) {
    terminal.buffer.x = this.value;
  });
  panel.appendChild(xElem.view);

  var yElem = createDisplayElement("Y:", function (ev) {
    terminal.buffer.y = this.value;
  });
  panel.appendChild(yElem.view);

  var linesElem = createDisplayElement("Lines length:", function (ev) {
  });
  panel.appendChild(linesElem.view);

  setInterval(function () {
    rowsElem.valueElem.innerHTML = terminal.rows.toString();
    colsElem.valueElem.innerHTML = terminal.cols.toString();
    ydispElem.valueElem.innerHTML = terminal.buffer.ydisp.toString();
    yBaseElem.valueElem.innerHTML = terminal.buffer.ybase.toString();
    scrollTopElem.valueElem.innerHTML = terminal.buffer.scrollTop.toString();
    scrollBottomElem.valueElem.innerHTML = terminal.buffer.scrollBottom.toString();
    xElem.valueElem.innerHTML = terminal.buffer.x.toString();
    yElem.valueElem.innerHTML = terminal.buffer.y.toString();
    linesElem.valueElem.innerHTML = terminal.buffer.lines.length.toString();
  }, 500);

  var resizeButton = addRefreshButton(terminal);
  resizeButton.className = "resize-button";
  rightPanel.appendChild(resizeButton);
}

function createDisplayElement(title, func) {
  var parentElem = document.createElement("div");

  //inner content
  var titleElement = document.createElement("span");
  titleElement.innerHTML = title;
  var valueElement = document.createElement("span");
  valueElement.classList = 'value-disp';

  var inputElement = document.createElement("input");
  inputElement.className = "term-disp";
  inputElement.type = "number";

  inputElement.addEventListener("change", func);

  parentElem.appendChild(titleElement);
  parentElem.appendChild(valueElement);
  parentElem.appendChild(inputElement);

  parentElem.className = "elem";

  return {view: parentElem, valueElem: valueElement};
}

function addRefreshButton(terminal) {
  var button = document.createElement("button");
  button.innerHTML = "Refresh";
  button.addEventListener("click", function () {
    terminal.refresh(0, terminal.rows - 1);
    terminal.showCursor();
  });
  return button;
}

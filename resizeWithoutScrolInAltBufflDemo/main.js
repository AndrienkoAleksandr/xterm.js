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

var terminalContainer = document.getElementById('terminal-container');
var verticalResizer = document.getElementsByClassName('gutter gutter-vertical')[0];
var horizontalResizer = document.getElementsByClassName('gutter gutter-horizontal')[0];
var rightPanel = document.getElementById("right");

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
    cursorBlink: false,
    scrollback: 1000,
    tabStopWidth: 4
  });

  createTerminalInfoTools(term, rightPanel);

  protocol = (location.protocol === 'https:') ? 'wss://' : 'ws://';
  socketURL = 'ws://localhost:9000/pty';

  term.open(terminalContainer);
  term.fit();

  var initialGeometry = term.proposeGeometry(),
      cols = initialGeometry.cols,
      rows = initialGeometry.rows;

  term.on('resize', function (size) {
    sock.send(JSON.stringify({
      type: "resize",
      "data": [size.cols, size.rows]
    }));
  });

  term.on('title', function (title) {
    document.title = title;
  });

  term.on('data', function (data) {
    sock.send(JSON.stringify({
      type: "data",
      "data": data
    }));
  });

  sock = new WebSocket(socketURL);

  sock.onmessage = function (msg) {
    term.write(msg.data);
  };

  sock.onerror = function (e) {
    console.log("socket error", e);
  };

  sock.onopen = function (e) {
    sock.send(JSON.stringify({
      type: "resize",
      "data": [cols, rows]
    }));
  };
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
    terminal.ydisp = this.value;
  });
  panel.appendChild(ydispElem.view);

  var yBaseElem = createDisplayElement("Ybase:", function (ev) {
    terminal.ybase = this.value;
  });
  panel.appendChild(yBaseElem.view);

  var scrollTopElem = createDisplayElement("ScrollTop:", function (ev) {
    terminal.scrollTop = this.value;
  });
  panel.appendChild(scrollTopElem.view);

  var xElem = createDisplayElement("X:", function (ev) {
    terminal.x = this.value;
  });
  panel.appendChild(xElem.view);

  var yElem = createDisplayElement("Y:", function (ev) {
    terminal.y = this.value;
  });
  panel.appendChild(yElem.view);

  var linesElem = createDisplayElement("Lines length:", function (ev) {
  });
  panel.appendChild(linesElem.view);

  var diffElem = createDisplayElement("Diff:", function (ev) {
  });
  panel.appendChild(diffElem.view);

  var diffYbaseElem = createDisplayElement("YBaseDiff:", function (ev) {
  });
  panel.appendChild(diffYbaseElem.view);

  setInterval(function () {
    rowsElem.valueElem.innerHTML = terminal.rows.toString();
    colsElem.valueElem.innerHTML = terminal.cols.toString();
    ydispElem.valueElem.innerHTML = terminal.ydisp.toString();
    yBaseElem.valueElem.innerHTML = terminal.ybase.toString();
    scrollTopElem.valueElem.innerHTML = terminal.scrollTop.toString();
    xElem.valueElem.innerHTML = terminal.x.toString();
    yElem.valueElem.innerHTML = terminal.y.toString();
    linesElem.valueElem.innerHTML = terminal.lines.length.toString();
    diffElem.valueElem.innerHTML = terminal.diff;
    diffYbaseElem.valueElem.innerHTML = terminal.ybase;
  }, 500);

  var resizeButton = addResizeButton(terminal);
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

function addResizeButton(terminal) {
  var button = document.createElement("button");
  button.innerHTML = "Resize terminal";
  button.addEventListener("click", function () {
    terminal.resize();
  });
  return button;
}



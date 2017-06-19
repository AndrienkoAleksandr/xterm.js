import {assert} from 'chai';
import {InputHandler} from './InputHandler';
import {ITerminal} from './Interfaces';
import {CircularList} from './utils/CircularList';

describe('InputHandler', () => {
  describe('setCursorStyle', () => {
    it('should call Terminal.setOption with correct params', () => {
      let options = {};
      let terminal = {
        setOption: (option, value) => options[option] = value
      };
      let inputHandler = new InputHandler(terminal);

      inputHandler.setCursorStyle([0]);
      assert.equal(options['cursorStyle'], 'block');
      assert.equal(options['cursorBlink'], true);

      options = {};
      inputHandler.setCursorStyle([1]);
      assert.equal(options['cursorStyle'], 'block');
      assert.equal(options['cursorBlink'], true);

      options = {};
      inputHandler.setCursorStyle([2]);
      assert.equal(options['cursorStyle'], 'block');
      assert.equal(options['cursorBlink'], false);

      options = {};
      inputHandler.setCursorStyle([3]);
      assert.equal(options['cursorStyle'], 'underline');
      assert.equal(options['cursorBlink'], true);

      options = {};
      inputHandler.setCursorStyle([4]);
      assert.equal(options['cursorStyle'], 'underline');
      assert.equal(options['cursorBlink'], false);

      options = {};
      inputHandler.setCursorStyle([5]);
      assert.equal(options['cursorStyle'], 'bar');
      assert.equal(options['cursorBlink'], true);

      options = {};
      inputHandler.setCursorStyle([6]);
      assert.equal(options['cursorStyle'], 'bar');
      assert.equal(options['cursorBlink'], false);

    });
  });

  describe('calculate terminal diff', () => {
    it('calculate diff when terminal lines stat with lines with content and ends on the empty lines', () => {
      let terminal: ITerminal;
      let inputHandler: InputHandler;
      let rowsSize: number;
      rowsSize = 5;
      terminal = <any>{cols: 10, rows: rowsSize, lines: new CircularList(rowsSize) };
      inputHandler = new InputHandler(terminal);

      terminal.lines.push('first line');
      terminal.lines.push('second line');
      terminal.lines.push('');
      terminal.lines.push('');
      terminal.lines.push('');

      // print all lines
      // terminal.lines.forEach(function (elem) {
      //   log(elem);
      // });

      assert.equal(terminal.lines.get(0), 'first line');
      assert.equal(terminal.lines.get(1), 'second line');
      assert.equal(terminal.lines.get(2), '');
      assert.equal(terminal.lines.get(3), '');
      assert.equal(terminal.lines.get(4), '');

      assert.equal(inputHandler.calculateDiff(terminal.lines), 3);
    });

    it('calculate diff when terminal lines consist of empty lines', () => {
      let terminal: ITerminal;
      let inputHandler: InputHandler;
      let rowsSize: number;
      rowsSize = 5;
      terminal = <any>{cols: 10, rows: rowsSize, lines: new CircularList(rowsSize) };
      inputHandler = new InputHandler(terminal);

      terminal.lines.push('');
      terminal.lines.push('');
      terminal.lines.push('');
      terminal.lines.push('');
      terminal.lines.push('');

      assert.equal(inputHandler.calculateDiff(terminal.lines), 5);
    });

    it('calculate diff when terminal lines consist of not empty lines', () => {
      let terminal: ITerminal;
      let inputHandler: InputHandler;
      let rowsSize: number;
      rowsSize = 5;
      terminal = <any>{cols: 10, rows: rowsSize, lines: new CircularList(rowsSize) };
      inputHandler = new InputHandler(terminal);

      terminal.lines.push('first line');
      terminal.lines.push('second line');
      terminal.lines.push('third line');
      terminal.lines.push('fourth line');
      terminal.lines.push('fifth line');

      assert.equal(inputHandler.calculateDiff(terminal.lines), 0);
    });

    it('calculate diff when terminal lines consist of not empty lines', () => {
      let terminal: ITerminal;
      let inputHandler: InputHandler;
      let rowsSize: number;
      rowsSize = 5;
      terminal = <any>{cols: 10, rows: rowsSize, lines: new CircularList(rowsSize) };
      inputHandler = new InputHandler(terminal);

      terminal.lines.push('first line');
      terminal.lines.push('second line');
      terminal.lines.push('third line');
      terminal.lines.push('fourth line');
      terminal.lines.push('fifth line');

      assert.equal(inputHandler.calculateDiff(terminal.lines), 0);
    });

    it('calculate diff when terminal lines consist of empty lines in the middle and in the end of the lines', () => {
      let terminal: ITerminal;
      let inputHandler: InputHandler;
      let rowsSize: number;
      rowsSize = 5;
      terminal = <any>{cols: 10, rows: rowsSize, lines: new CircularList(rowsSize) };
      inputHandler = new InputHandler(terminal);

      terminal.lines.push('first line');
      terminal.lines.push('');
      terminal.lines.push('third line');
      terminal.lines.push('fourth line');
      terminal.lines.push('');

      assert.equal(inputHandler.calculateDiff(terminal.lines), 1);
    });
  });
});

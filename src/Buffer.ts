/**
 * @license MIT
 */

import { ITerminal } from './Interfaces';
import { CircularList } from './utils/CircularList';

export class Buffer {
  private _lines: CircularList<string>;
  private _ybase: number;
  private _ydisp: number;
  private _y: number;
  private _x: number;
  private _tabs: any; // todo check applying custom tabs size to the alt buffer...
  private _diff: number; // todo think about implementation
  private _scrollTop: number;
  private _scrollBottom: number;
  // Todo cursorHidden: boolean;  todo seems should be moved to the buffer and restored after switching from alt buffer to normal buffer(and otherwise) => 1047, 47, 1049 in the InputHandler!!!!
  // Todo cursorState: number; todo seems should be moved to the buffer  and restored after switching from alt buffer to normal buffer(and otherwise) => 1047, 47, 1049 in the InputHandler!!!!

  constructor(private terminal: ITerminal) {
    this._lines = new CircularList<string>(this.terminal.scrollback);
  }

  public get lines(): CircularList<string> {
    return this._lines;
  }

  public set lines(lines: CircularList<string>) {
    this._lines = lines;
  }

  public get ybase(): number {
    return this._ybase;
  }

  public set ybase(ybase: number) {
    this._ybase = ybase;
  }

  public get ydisp(): number {
    return this._ydisp;
  }

  public set ydisp(ydisp: number) {
    this._ydisp = ydisp;
  }

  public get tabs(): number {
    return this._tabs;
  }

  public set tabs(tabs: number) {
    this._tabs = tabs;
  }

  public get x(): number {
    return this._x;
  }

  public set x(x: number) {
    this._x = x;
  }

  public get y(): number {
    return this._y;
  }

  public set y(y: number) {
    this._y = y;
  }

  public get scrollTop(): number {
    return this._scrollTop;
  }

  public set scrollTop(scrollTop: number ) {
    this._scrollTop = scrollTop;
  }

  public get scrollBottom(): number {
    return this._scrollBottom;
  }

  public set scrollBottom(scrollBottom: number) {
    this._scrollBottom = scrollBottom;
  }
}

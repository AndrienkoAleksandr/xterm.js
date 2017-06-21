/**
 * @license MIT
 */

import { ITerminal } from './Interfaces';
import { CircularList } from './utils/CircularList';

export class Buffer {
  private _lines: CircularList<any>;
  private _ybase: number;
  private _ydisp: number;
  private _y: number;
  private _x: number;
  private _tabs: any; // todo check applying custom tabs size to the alt buffer...
  private _diff: number; // todo think about implementation
  // Todo cursorHidden: boolean;  todo seems should be moved to the buffer and restored after switching from alt buffer to normal buffer(and otherwise) => 1047, 47, 1049 in the InputHandler!!!!
  // Todo cursorState: number; todo seems should be moved to the buffer  and restored after switching from alt buffer to normal buffer(and otherwise) => 1047, 47, 1049 in the InputHandler!!!!

  constructor(private terminal: ITerminal) {
    this._lines = new CircularList(this.terminal.scrollback);
  }

  public get lines(): CircularList<string> {
    return this._lines;
  }
}

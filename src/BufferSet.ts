/**
 * @license MIT
 * @author Paris Kasidiaris
 * paris@sourcelair.com
 */

import { ITerminal } from './Interfaces';
import { Buffer } from './Buffer';
import {EventEmitter} from './EventEmitter';

export class BufferSet extends EventEmitter {
  private _normal: Buffer;
  private _alt: Buffer;
  private _activeBuffer: Buffer;

  constructor(private _terminal: ITerminal) {
    super();
    this._normal = new Buffer(this._terminal);
    this._alt = new Buffer(this._terminal);
    this._activeBuffer = this._normal;
  }

  public get alt(): Buffer {
    return this._alt;
  }

  public get active(): Buffer {
    return this._activeBuffer;
  }

  public get normal(): Buffer {
    return this._normal;
  }

  public activateNormalBuffer(): void {
    this._activeBuffer = this._normal;

    this._terminal.refresh(0, this._terminal.rows - 1);
    // this._terminal.viewport.syncScrollArea();
    // this._terminal.showCursor();

    this.emit('activate', this._normal);
  }

  public activateAltBuffer(doClear: boolean): void {
    this._activeBuffer = this._alt;

    if (doClear) {
      this._terminal.reset();
    }
    this._terminal.viewport.syncScrollArea(); // Todo I'm not sure that we need it for alt buffer
    this._terminal.showCursor();

    this.emit('activate', this._alt);
  }
}

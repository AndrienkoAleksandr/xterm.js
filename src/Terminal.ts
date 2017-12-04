/**
 * Copyright (c) 2014 The xterm.js authors. All rights reserved.
 * Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
 * @license MIT
 *
 * Originally forked from (with the author's permission):
 *   Fabrice Bellard's javascript vt100 for jslinux:
 *   http://bellard.org/jslinux/
 *   Copyright (c) 2011 Fabrice Bellard
 *   The original design remains. The terminal itself
 *   has been extended to include xterm CSI codes, among
 *   other features.
 *
 * Terminal Emulation References:
 *   http://vt100.net/
 *   http://invisible-island.net/xterm/ctlseqs/ctlseqs.txt
 *   http://invisible-island.net/xterm/ctlseqs/ctlseqs.html
 *   http://invisible-island.net/vttest/
 *   http://www.inwap.com/pdp10/ansicode.txt
 *   http://linux.die.net/man/4/console_codes
 *   http://linux.die.net/man/7/urxvt
 */

import { BufferSet } from './BufferSet';
import { Buffer, MAX_BUFFER_SIZE } from './Buffer';
import { CompositionHelper } from './CompositionHelper';
import { EventEmitter } from './EventEmitter';
import { Viewport } from './Viewport';
import { C0 } from './EscapeSequences';
import { InputHandler } from './InputHandler';
import { Parser } from './Parser';
import { Renderer } from './renderer/Renderer';
import { SelectionManager } from './SelectionManager';
import { CharMeasure } from './utils/CharMeasure';
import * as Browser from './utils/Browser';
import { MouseHelper } from './utils/MouseHelper';
import { CustomKeyEventHandler, Charset, CharData, LineData } from './Types';
import { ITerminal, IBrowser, ITerminalOptions, IInputHandlingTerminal, IViewport, ICompositionHelper, ITheme } from './Interfaces';
import { DEFAULT_ANSI_COLORS } from './renderer/ColorManager';
import { IMouseZoneManager } from './input/Interfaces';
import { MouseZoneManager } from './input/MouseZoneManager';
import { initialize as initializeCharAtlas } from './renderer/CharAtlas';
import { IRenderer } from './renderer/Interfaces';

// Declares required for loadAddon
declare var exports: any;
declare var module: any;
declare var define: any;
declare var require: any;

// Let it work inside Node.js for automated testing purposes.
const document = (typeof window !== 'undefined') ? window.document : null;

/**
 * The amount of write requests to queue before sending an XOFF signal to the
 * pty process. This number must be small in order for ^C and similar sequences
 * to be responsive.
 */
const WRITE_BUFFER_PAUSE_THRESHOLD = 5;

/**
 * The number of writes to perform in a single batch before allowing the
 * renderer to catch up with a 0ms setTimeout.
 */
const WRITE_BATCH_SIZE = 300;

const DEFAULT_OPTIONS: ITerminalOptions = {
  cols: 80,
  rows: 24,
  convertEol: false,
  termName: 'xterm',
  cursorBlink: false,
  cursorStyle: 'block',
  enableBold: true,
  fontFamily: 'courier-new, courier, monospace',
  fontSize: 15,
  lineHeight: 1.0,
  letterSpacing: 0,
  scrollback: 1000,
  screenKeys: false,
  debug: false,
  cancelEvents: false,
  disableStdin: false,
  useFlowControl: false,
  tabStopWidth: 8,
  theme: null
  // programFeatures: false,
  // focusKeys: false,
};

export class Terminal extends EventEmitter implements ITerminal, IInputHandlingTerminal {
  public textarea: HTMLTextAreaElement;
  public element: HTMLElement;

  /**
   * The HTMLElement that the terminal is created in, set by Terminal.open.
   */
  private parent: HTMLElement;
  private context: Window;
  private document: Document;
  private body: HTMLBodyElement;
  private viewportScrollArea: HTMLElement;
  private viewportElement: HTMLElement;
  private helperContainer: HTMLElement;
  private compositionView: HTMLElement;
  private charSizeStyleElement: HTMLStyleElement;
  private bellAudioElement: HTMLAudioElement;
  private visualBellTimer: number;

  public browser: IBrowser = <any>Browser;

  public options: ITerminalOptions;
  private colors: any;

  // TODO: This can be changed to an enum or boolean, 0 and 1 seem to be the only options
  public cursorState: number;
  public cursorHidden: boolean;
  public convertEol: boolean;

  private sendDataQueue: string;
  private customKeyEventHandler: CustomKeyEventHandler;

  // modes
  public applicationKeypad: boolean;
  public applicationCursor: boolean;
  public originMode: boolean;
  public insertMode: boolean;
  public wraparoundMode: boolean; // defaults: xterm - true, vt100 - false
  public bracketedPasteMode: boolean;

  // charset
  // The current charset
  public charset: Charset;
  public gcharset: number;
  public glevel: number;
  public charsets: Charset[];

  // mouse properties
  private decLocator: boolean; // This is unstable and never set
  public normalMouse: boolean;
  public mouseEvents: boolean;
  public sendFocus: boolean;
  public utfMouse: boolean;
  public sgrMouse: boolean;
  public urxvtMouse: boolean;

  // misc
  private refreshStart: number;
  private refreshEnd: number;
  public savedCols: number;

  // stream
  private readable: boolean;
  private writable: boolean;

  public defAttr: number;
  public curAttr: number;

  public params: (string | number)[];
  public currentParam: string | number;
  public prefix: string;
  public postfix: string;

  // user input states
  public writeBuffer: string[];
  private writeInProgress: boolean;

  /**
   * Whether _xterm.js_ sent XOFF in order to catch up with the pty process.
   * This is a distinct state from writeStopped so that if the user requested
   * XOFF via ^S that it will not automatically resume when the writeBuffer goes
   * below threshold.
   */
  private xoffSentToCatchUp: boolean;

  /** Whether writing has been stopped as a result of XOFF */
  private writeStopped: boolean;

  // leftover surrogate high from previous write invocation
  private surrogate_high: string;

  // Store if user went browsing history in scrollback
  private userScrolling: boolean;

  private inputHandler: InputHandler;
  private parser: Parser;
  public renderer: IRenderer;
  public selectionManager: SelectionManager;
  public buffers: BufferSet;
  public buffer: Buffer;
  public viewport: IViewport;
  private compositionHelper: ICompositionHelper;
  public charMeasure: CharMeasure;
  private _mouseZoneManager: IMouseZoneManager;
  public mouseHelper: MouseHelper;

  public cols: number;
  public rows: number;

  /**
   * Creates a new `Terminal` object.
   *
   * @param {object} options An object containing a set of options, the available options are:
   *   - `cursorBlink` (boolean): Whether the terminal cursor blinks
   *   - `cols` (number): The number of columns of the terminal (horizontal size)
   *   - `rows` (number): The number of rows of the terminal (vertical size)
   *
   * @public
   * @class Xterm Xterm
   * @alias module:xterm/src/xterm
   */
  constructor(
    options: ITerminalOptions = {}
  ) {
    super();
    this.options = options;
    this.setup();
  }

  private setup(): void {
    Object.keys(DEFAULT_OPTIONS).forEach((key) => {
      if (this.options[key] == null) {
        this.options[key] = DEFAULT_OPTIONS[key];
      }
      // TODO: We should move away from duplicate options on the Terminal object
      this[key] = this.options[key];
    });

    // this.context = options.context || window;
    // this.document = options.document || document;
    // TODO: WHy not document.body?
    this.parent = document ? document.body : null;

    this.cols = this.options.cols;
    this.rows = this.options.rows;

    if (this.options.handler) {
      this.on('data', this.options.handler);
    }

    this.cursorState = 0;
    this.cursorHidden = false;
    this.sendDataQueue = '';
    this.customKeyEventHandler = null;

    // modes
    this.applicationKeypad = false;
    this.applicationCursor = false;
    this.originMode = false;
    this.insertMode = false;
    this.wraparoundMode = true; // defaults: xterm - true, vt100 - false
    this.bracketedPasteMode = false;

    // charset
    this.charset = null;
    this.gcharset = null;
    this.glevel = 0;
    // TODO: Can this be just []?
    this.charsets = [null];

    this.readable = true;
    this.writable = true;

    this.defAttr = (0 << 18) | (257 << 9) | (256 << 0);
    this.curAttr = (0 << 18) | (257 << 9) | (256 << 0);

    this.params = [];
    this.currentParam = 0;
    this.prefix = '';
    this.postfix = '';

    // user input states
    this.writeBuffer = [];
    this.writeInProgress = false;

    this.xoffSentToCatchUp = false;
    this.writeStopped = false;
    this.surrogate_high = '';
    this.userScrolling = false;

    this.inputHandler = new InputHandler(this);
    this.parser = new Parser(this.inputHandler, this);
    // Reuse renderer if the Terminal is being recreated via a reset call.
    this.renderer = this.renderer || null;
    this.selectionManager = this.selectionManager || null;
    this._mouseZoneManager = this._mouseZoneManager || null;

    // Create the terminal's buffers and set the current buffer
    this.buffers = new BufferSet(this);
    this.buffer = this.buffers.active;  // Convenience shortcut;
    this.buffers.on('activate', (buffer: Buffer) => {
      this.buffer = buffer;
    });

    // Ensure the selection manager has the correct buffer
    if (this.selectionManager) {
      this.selectionManager.setBuffer(this.buffer);
    }
  }

  /**
   * back_color_erase feature for xterm.
   */
  public eraseAttr(): number {
    // if (this.is('screen')) return this.defAttr;
    return (this.defAttr & ~0x1ff) | (this.curAttr & 0x1ff);
  }

  public get isFocused(): boolean {
    return document.activeElement === this.textarea;
  }

  /**
   * Retrieves an option's value from the terminal.
   * @param {string} key The option key.
   */
  public getOption(key: string): any {
    if (!(key in DEFAULT_OPTIONS)) {
      throw new Error('No option with key "' + key + '"');
    }

    if (typeof this.options[key] !== 'undefined') {
      return this.options[key];
    }

    return this[key];
  }

  /**
   * Sets an option on the terminal.
   * @param {string} key The option key.
   * @param {any} value The option value.
   */
  public setOption(key: string, value: any): void {
    if (!(key in DEFAULT_OPTIONS)) {
      throw new Error('No option with key "' + key + '"');
    }
    switch (key) {
      case 'bellStyle':
        if (!value) {
          value = 'none';
        }
        break;
      case 'cursorStyle':
        if (!value) {
          value = 'block';
        }
        break;
      case 'lineHeight':
        if (value < 1) {
          console.warn(`${key} cannot be less than 1, value: ${value}`);
          return;
        }
      case 'tabStopWidth':
        if (value < 1) {
          console.warn(`${key} cannot be less than 1, value: ${value}`);
          return;
        }
        break;
      case 'theme':
        // If open has been called we do not want to set options.theme as the
        // source of truth is owned by the renderer.
        if (this.renderer) {
          this._setTheme(<ITheme>value);
          return;
        }
        break;
      case 'scrollback':
        value = Math.min(value, MAX_BUFFER_SIZE);

        if (value < 0) {
          console.warn(`${key} cannot be less than 0, value: ${value}`);
          return;
        }
        if (this.options[key] !== value) {
          const newBufferLength = this.rows + value;
          if (this.buffer.lines.length > newBufferLength) {
            const amountToTrim = this.buffer.lines.length - newBufferLength;
            const needsRefresh = (this.buffer.ydisp - amountToTrim < 0);
            this.buffer.lines.trimStart(amountToTrim);
            this.buffer.ybase = Math.max(this.buffer.ybase - amountToTrim, 0);
            this.buffer.ydisp = Math.max(this.buffer.ydisp - amountToTrim, 0);
            if (needsRefresh) {
              this.refresh(0, this.rows - 1);
            }
          }
        }
        break;
    }
    this[key] = value;
    this.options[key] = value;
    switch (key) {
      case 'fontFamily':
      case 'fontSize':
        // When the font changes the size of the cells may change which requires a renderer clear
        this.renderer.clear();
        this.charMeasure.measure(this.options);
        break;
      case 'enableBold':
      case 'letterSpacing':
      case 'lineHeight':
        // When the font changes the size of the cells may change which requires a renderer clear
        this.renderer.clear();
        this.renderer.onResize(this.cols, this.rows, false);
        this.refresh(0, this.rows - 1);
        // this.charMeasure.measure(this.options);
      case 'scrollback':
        this.buffers.resize(this.cols, this.rows);
        this.viewport.syncScrollArea();
        break;
      case 'tabStopWidth': this.buffers.setupTabStops(); break;
      case 'bellSound':
    }
    // Inform renderer of changes
    if (this.renderer) {
      this.renderer.onOptionsChanged();
    }
  }

  /**
   * Opens the terminal within an element.
   *
   * @param {HTMLElement} parent The element to create the terminal within.
   */
  public open(parent: HTMLElement): void {
    let i = 0;
    let div;

    this.parent = parent || this.parent;

    if (!this.parent) {
      throw new Error('Terminal requires a parent element.');
    }

    // Grab global elements
    this.context = this.parent.ownerDocument.defaultView;
    this.document = this.parent.ownerDocument;
    this.body = <HTMLBodyElement>this.document.body;

    initializeCharAtlas(this.document);

    // Create main element container
    this.element = this.document.createElement('div');
    this.element.classList.add('terminal');
    this.element.classList.add('xterm');

    this.element.setAttribute('tabindex', '0');

    this.viewportElement = document.createElement('div');
    this.viewportElement.classList.add('xterm-viewport');
    this.element.appendChild(this.viewportElement);
    this.viewportScrollArea = document.createElement('div');
    this.viewportScrollArea.classList.add('xterm-scroll-area');
    this.viewportElement.appendChild(this.viewportScrollArea);

    this._mouseZoneManager = new MouseZoneManager(this);
    this.on('scroll', () => this._mouseZoneManager.clearAll());

    // Create the container that will hold helpers like the textarea for
    // capturing DOM Events. Then produce the helpers.
    this.helperContainer = document.createElement('div');
    this.helperContainer.classList.add('xterm-helpers');
    // TODO: This should probably be inserted once it's filled to prevent an additional layout
    this.element.appendChild(this.helperContainer);
    this.textarea = document.createElement('textarea');
    this.textarea.classList.add('xterm-helper-textarea');
    this.textarea.setAttribute('autocorrect', 'off');
    this.textarea.setAttribute('autocapitalize', 'off');
    this.textarea.setAttribute('spellcheck', 'false');
    this.textarea.tabIndex = 0;
    this.helperContainer.appendChild(this.textarea);

    this.compositionView = document.createElement('div');
    this.compositionView.classList.add('composition-view');
    this.compositionHelper = new CompositionHelper(this.textarea, this.compositionView, this);
    this.helperContainer.appendChild(this.compositionView);

    this.charSizeStyleElement = document.createElement('style');
    this.helperContainer.appendChild(this.charSizeStyleElement);

    this.parent.appendChild(this.element);

    this.charMeasure = new CharMeasure(document, this.helperContainer);

    this.renderer = new Renderer(this, this.options.theme);
    this.options.theme = null;
    this.viewport = new Viewport(this, this.viewportElement, this.viewportScrollArea, this.charMeasure);
    this.viewport.onThemeChanged(this.renderer.colorManager.colors);

    this.on('cursormove', () => this.renderer.onCursorMove());
    this.on('resize', () => this.renderer.onResize(this.cols, this.rows, false));
    window.addEventListener('resize', () => this.renderer.onWindowResize(window.devicePixelRatio));
    this.charMeasure.on('charsizechanged', () => this.renderer.onResize(this.cols, this.rows, true));
    this.renderer.on('resize', (dimensions) => this.viewport.syncScrollArea());

    this.selectionManager = new SelectionManager(this, this.buffer, this.charMeasure);
    this.selectionManager.on('refresh', data => this.renderer.onSelectionChanged(data.start, data.end));
    this.selectionManager.on('newselection', text => {
      // If there's a new selection, put it into the textarea, focus and select it
      // in order to register it as a selection on the OS. This event is fired
      // only on Linux to enable middle click to paste selection.
      this.textarea.value = text;
      this.textarea.focus();
      this.textarea.select();
    });
    this.on('scroll', () => {
      this.viewport.syncScrollArea();
      this.selectionManager.refresh();
    });
    this.viewportElement.addEventListener('scroll', () => this.selectionManager.refresh());

    this.mouseHelper = new MouseHelper(this.renderer);

    // Measure the character size
    this.charMeasure.measure(this.options);

    // Setup loop that draws to screen
    this.refresh(0, this.rows - 1);
  }

  /**
   * Sets the theme on the renderer. The renderer must have been initialized.
   * @param theme The theme to ste.
   */
  private _setTheme(theme: ITheme): void {
    const colors = this.renderer.setTheme(theme);
    if (this.viewport) {
      this.viewport.onThemeChanged(colors);
    }
  }

  /**
   * Attempts to load an add-on using CommonJS or RequireJS (whichever is available).
   * @param {string} addon The name of the addon to load
   * @static
   */
  public static loadAddon(addon: string, callback?: Function): boolean | any {
    // TODO: Improve return type and documentation
    if (typeof exports === 'object' && typeof module === 'object') {
      // CommonJS
      return require('./addons/' + addon + '/' + addon);
    } else if (typeof define === 'function') {
      // RequireJS
      return (<any>require)(['./addons/' + addon + '/' + addon], callback);
    } else {
      console.error('Cannot load a module without a CommonJS or RequireJS environment.');
      return false;
    }
  }

  /**
   * Destroys the terminal.
   */
  public destroy(): void {
    super.destroy();
    this.readable = false;
    this.writable = false;
    this.handler = () => {};
    this.write = () => {};
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    // this.emit('close');
  }

  /**
   * Tells the renderer to refresh terminal content between two rows (inclusive) at the next
   * opportunity.
   * @param {number} start The row to start from (between 0 and this.rows - 1).
   * @param {number} end The row to end at (between start and this.rows - 1).
   */
  public refresh(start: number, end: number): void {
    if (this.renderer) {
      this.renderer.queueRefresh(start, end);
    }
  }

  /**
   * Display the cursor element
   */
  public showCursor(): void {
    if (!this.cursorState) {
      this.cursorState = 1;
      this.refresh(this.buffer.y, this.buffer.y);
    }
  }

  /**
   * Scroll the terminal down 1 row, creating a blank line.
   * @param isWrapped Whether the new line is wrapped from the previous line.
   */
  public scroll(isWrapped?: boolean): void {
    const newLine = this.blankLine(undefined, isWrapped);
    const topRow = this.buffer.ybase + this.buffer.scrollTop;
    let bottomRow = this.buffer.ybase + this.buffer.scrollBottom;

    if (this.buffer.scrollTop === 0) {
      // Determine whether the buffer is going to be trimmed after insertion.
      const willBufferBeTrimmed = this.buffer.lines.length === this.buffer.lines.maxLength;

      // Insert the line using the fastest method
      if (bottomRow === this.buffer.lines.length - 1) {
        this.buffer.lines.push(newLine);
      } else {
        this.buffer.lines.splice(bottomRow + 1, 0, newLine);
      }

      // Only adjust ybase and ydisp when the buffer is not trimmed
      if (!willBufferBeTrimmed) {
        this.buffer.ybase++;
        // Only scroll the ydisp with ybase if the user has not scrolled up
        if (!this.userScrolling) {
          this.buffer.ydisp++;
        }
      } else {
        // When the buffer is full and the user has scrolled up, keep the text
        // stable unless ydisp is right at the top
        if (this.userScrolling) {
          this.buffer.ydisp = Math.max(this.buffer.ydisp - 1, 0);
        }
      }
    } else {
      // scrollTop is non-zero which means no line will be going to the
      // scrollback, instead we can just shift them in-place.
      const scrollRegionHeight = bottomRow - topRow + 1/*as it's zero-based*/;
      this.buffer.lines.shiftElements(topRow + 1, scrollRegionHeight - 1, -1);
      this.buffer.lines.set(bottomRow, newLine);
    }

    // Move the viewport to the bottom of the buffer unless the user is
    // scrolling.
    if (!this.userScrolling) {
      this.buffer.ydisp = this.buffer.ybase;
    }

    // Flag rows that need updating
    this.updateRange(this.buffer.scrollTop);
    this.updateRange(this.buffer.scrollBottom);

    /**
     * This event is emitted whenever the terminal is scrolled.
     * The one parameter passed is the new y display position.
     *
     * @event scroll
     */
    this.emit('scroll', this.buffer.ydisp);
  }

  /**
   * Scroll the display of the terminal
   * @param {number} disp The number of lines to scroll down (negative scroll up).
   * @param {boolean} suppressScrollEvent Don't emit the scroll event as scrollLines. This is used
   * to avoid unwanted events being handled by the viewport when the event was triggered from the
   * viewport originally.
   */
  public scrollLines(disp: number, suppressScrollEvent?: boolean): void {
    if (disp < 0) {
      if (this.buffer.ydisp === 0) {
        return;
      }
      this.userScrolling = true;
    } else if (disp + this.buffer.ydisp >= this.buffer.ybase) {
      this.userScrolling = false;
    }

    const oldYdisp = this.buffer.ydisp;
    this.buffer.ydisp = Math.max(Math.min(this.buffer.ydisp + disp, this.buffer.ybase), 0);

    // No change occurred, don't trigger scroll/refresh
    if (oldYdisp === this.buffer.ydisp) {
      return;
    }

    if (!suppressScrollEvent) {
      this.emit('scroll', this.buffer.ydisp);
    }

    this.refresh(0, this.rows - 1);
  }

  /**
   * Scroll the display of the terminal by a number of pages.
   * @param {number} pageCount The number of pages to scroll (negative scrolls up).
   */
  public scrollPages(pageCount: number): void {
    this.scrollLines(pageCount * (this.rows - 1));
  }

  /**
   * Scrolls the display of the terminal to the top.
   */
  public scrollToTop(): void {
    this.scrollLines(-this.buffer.ydisp);
  }

  /**
   * Scrolls the display of the terminal to the bottom.
   */
  public scrollToBottom(): void {
    this.scrollLines(this.buffer.ybase - this.buffer.ydisp);
  }

  /**
   * Writes text to the terminal.
   * @param {string} data The text to write to the terminal.
   */
  public write(data: string): void {
    this.writeBuffer.push(data);

    // Send XOFF to pause the pty process if the write buffer becomes too large so
    // xterm.js can catch up before more data is sent. This is necessary in order
    // to keep signals such as ^C responsive.
    if (this.options.useFlowControl && !this.xoffSentToCatchUp && this.writeBuffer.length >= WRITE_BUFFER_PAUSE_THRESHOLD) {
      // XOFF - stop pty pipe
      // XON will be triggered by emulator before processing data chunk
      this.send(C0.DC3);
      this.xoffSentToCatchUp = true;
    }

    if (!this.writeInProgress && this.writeBuffer.length > 0) {
      // Kick off a write which will write all data in sequence recursively
      this.writeInProgress = true;
      // Kick off an async innerWrite so more writes can come in while processing data
      setTimeout(() => {
        this.innerWrite();
      });
    }
  }

  private innerWrite(): void {
    const writeBatch = this.writeBuffer.splice(0, WRITE_BATCH_SIZE);
    while (writeBatch.length > 0) {
      const data = writeBatch.shift();

      // If XOFF was sent in order to catch up with the pty process, resume it if
      // the writeBuffer is empty to allow more data to come in.
      if (this.xoffSentToCatchUp && writeBatch.length === 0 && this.writeBuffer.length === 0) {
        this.send(C0.DC1);
        this.xoffSentToCatchUp = false;
      }

      this.refreshStart = this.buffer.y;
      this.refreshEnd = this.buffer.y;

      // HACK: Set the parser state based on it's state at the time of return.
      // This works around the bug #662 which saw the parser state reset in the
      // middle of parsing escape sequence in two chunks. For some reason the
      // state of the parser resets to 0 after exiting parser.parse. This change
      // just sets the state back based on the correct return statement.
      const state = this.parser.parse(data);
      this.parser.setState(state);

      this.updateRange(this.buffer.y);
      this.refresh(this.refreshStart, this.refreshEnd);
    }
    if (this.writeBuffer.length > 0) {
      // Allow renderer to catch up before processing the next batch
      setTimeout(() => this.innerWrite(), 0);
    } else {
      this.writeInProgress = false;
    }
  }

  /**
   * Writes text to the terminal, followed by a break line character (\n).
   * @param {string} data The text to write to the terminal.
   */
  public writeln(data: string): void {
    this.write(data + '\r\n');
  }

  /**
   * Attaches a custom key event handler which is run before keys are processed,
   * giving consumers of xterm.js ultimate control as to what keys should be
   * processed by the terminal and what keys should not.
   * @param customKeyEventHandler The custom KeyboardEvent handler to attach.
   * This is a function that takes a KeyboardEvent, allowing consumers to stop
   * propogation and/or prevent the default action. The function returns whether
   * the event should be processed by xterm.js.
   */
  public attachCustomKeyEventHandler(customKeyEventHandler: CustomKeyEventHandler): void {
    this.customKeyEventHandler = customKeyEventHandler;
  }

  /**
   * Gets whether the terminal has an active selection.
   */
  public hasSelection(): boolean {
    return this.selectionManager ? this.selectionManager.hasSelection : false;
  }

  /**
   * Gets the terminal's current selection, this is useful for implementing copy
   * behavior outside of xterm.js.
   */
  public getSelection(): string {
    return this.selectionManager ? this.selectionManager.selectionText : '';
  }

  /**
   * Clears the current terminal selection.
   */
  public clearSelection(): void {
    if (this.selectionManager) {
      this.selectionManager.clearSelection();
    }
  }

  /**
   * Selects all text within the terminal.
   */
  public selectAll(): void {
    if (this.selectionManager) {
      this.selectionManager.selectAll();
    }
  }

  /**
   * Set the G level of the terminal
   * @param g
   */
  public setgLevel(g: number): void {
    this.glevel = g;
    this.charset = this.charsets[g];
  }

  /**
   * Set the charset for the given G level of the terminal
   * @param g
   * @param charset
   */
  public setgCharset(g: number, charset: Charset): void {
    this.charsets[g] = charset;
    if (this.glevel === g) {
      this.charset = charset;
    }
  }

  /**
   * Send data for handling to the terminal
   * @param {string} data
   */
  public send(data: string): void {
    if (!this.sendDataQueue) {
      setTimeout(() => {
        this.handler(this.sendDataQueue);
        this.sendDataQueue = '';
      }, 1);
    }

    this.sendDataQueue += data;
  }

  /**
   * Log the current state to the console.
   */
  public log(text: string, data?: any): void {
    if (!this.options.debug) return;
    if (!this.context.console || !this.context.console.log) return;
    this.context.console.log(text, data);
  }

  /**
   * Log the current state as error to the console.
   */
  public error(text: string, data?: any): void {
    if (!this.options.debug) return;
    if (!this.context.console || !this.context.console.error) return;
    this.context.console.error(text, data);
  }

  /**
   * Resizes the terminal.
   *
   * @param {number} x The number of columns to resize to.
   * @param {number} y The number of rows to resize to.
   */
  public resize(x: number, y: number): void {
    if (isNaN(x) || isNaN(y)) {
      return;
    }

    if (x === this.cols && y === this.rows) {
      // Check if we still need to measure the char size (fixes #785).
      if (!this.charMeasure.width || !this.charMeasure.height) {
        this.charMeasure.measure(this.options);
      }
      return;
    }

    if (x < 1) x = 1;
    if (y < 1) y = 1;

    this.buffers.resize(x, y);

    this.cols = x;
    this.rows = y;
    this.buffers.setupTabStops(this.cols);

    this.charMeasure.measure(this.options);

    this.refresh(0, this.rows - 1);
    this.emit('resize', {cols: x, rows: y});
  }

  /**
   * Updates the range of rows to refresh
   * @param {number} y The number of rows to refresh next.
   */
  public updateRange(y: number): void {
    if (y < this.refreshStart) this.refreshStart = y;
    if (y > this.refreshEnd) this.refreshEnd = y;
    // if (y > this.refreshEnd) {
    //   this.refreshEnd = y;
    //   if (y > this.rows - 1) {
    //     this.refreshEnd = this.rows - 1;
    //   }
    // }
  }

  /**
   * Set the range of refreshing to the maximum value
   */
  public maxRange(): void {
    this.refreshStart = 0;
    this.refreshEnd = this.rows - 1;
  }

  /**
   * Erase in the identified line everything from "x" to the end of the line (right).
   * @param {number} x The column from which to start erasing to the end of the line.
   * @param {number} y The line in which to operate.
   */
  public eraseRight(x: number, y: number): void {
    const line = this.buffer.lines.get(this.buffer.ybase + y);
    if (!line) {
      return;
    }
    const ch: CharData = [this.eraseAttr(), ' ', 1, 32 /* ' '.charCodeAt(0) */]; // xterm
    for (; x < this.cols; x++) {
      line[x] = ch;
    }
    this.updateRange(y);
  }

  /**
   * Erase in the identified line everything from "x" to the start of the line (left).
   * @param {number} x The column from which to start erasing to the start of the line.
   * @param {number} y The line in which to operate.
   */
  public eraseLeft(x: number, y: number): void {
    const line = this.buffer.lines.get(this.buffer.ybase + y);
    if (!line) {
      return;
    }
    const ch: CharData = [this.eraseAttr(), ' ', 1, 32 /* ' '.charCodeAt(0) */]; // xterm
    x++;
    while (x--) {
      line[x] = ch;
    }
    this.updateRange(y);
  }

  /**
   * Clear the entire buffer, making the prompt line the new first line.
   */
  public clear(): void {
    if (this.buffer.ybase === 0 && this.buffer.y === 0) {
      // Don't clear if it's already clear
      return;
    }
    this.buffer.lines.set(0, this.buffer.lines.get(this.buffer.ybase + this.buffer.y));
    this.buffer.lines.length = 1;
    this.buffer.ydisp = 0;
    this.buffer.ybase = 0;
    this.buffer.y = 0;
    for (let i = 1; i < this.rows; i++) {
      this.buffer.lines.push(this.blankLine());
    }
    this.refresh(0, this.rows - 1);
    this.emit('scroll', this.buffer.ydisp);
  }

  /**
   * Erase all content in the given line
   * @param {number} y The line to erase all of its contents.
   */
  public eraseLine(y: number): void {
    this.eraseRight(0, y);
  }

  /**
   * Return the data array of a blank line
   * @param {boolean} cur First bunch of data for each "blank" character.
   * @param {boolean} isWrapped Whether the new line is wrapped from the previous line.
   * @param {boolean} cols The number of columns in the terminal, if this is not
   * set, the terminal's current column count would be used.
   */
  public blankLine(cur?: boolean, isWrapped?: boolean, cols?: number): LineData {
    const attr = cur ? this.eraseAttr() : this.defAttr;

    const ch: CharData = [attr, ' ', 1, 32 /* ' '.charCodeAt(0) */]; // width defaults to 1 halfwidth character
    const line: LineData = [];

    // TODO: It is not ideal that this is a property on an array, a buffer line
    // class should be added that will hold this data and other useful functions.
    if (isWrapped) {
      (<any>line).isWrapped = isWrapped;
    }

    cols = cols || this.cols;
    for (let i = 0; i < cols; i++) {
      line[i] = ch;
    }

    return line;
  }

  /**
   * If cur return the back color xterm feature attribute. Else return defAttr.
   * @param cur
   */
  public ch(cur?: boolean): CharData {
    if (cur) {
      return [this.eraseAttr(), ' ', 1, 32 /* ' '.charCodeAt(0) */];
    }
    return [this.defAttr, ' ', 1, 32 /* ' '.charCodeAt(0) */];
  }

  /**
   * Evaluate if the current terminal is the given argument.
   * @param term The terminal name to evaluate
   */
  public is(term: string): boolean {
    return (this.options.termName + '').indexOf(term) === 0;
  }

  /**
   * Emit the 'data' event and populate the given data.
   * @param {string} data The data to populate in the event.
   */
  public handler(data: string): void {
    // Prevents all events to pty process if stdin is disabled
    if (this.options.disableStdin) {
      return;
    }

    // Clear the selection if the selection manager is available and has an active selection
    if (this.selectionManager && this.selectionManager.hasSelection) {
      this.selectionManager.clearSelection();
    }

    // Input is being sent to the terminal, the terminal should focus the prompt.
    if (this.buffer.ybase !== this.buffer.ydisp) {
      this.scrollToBottom();
    }
    this.emit('data', data);
  }

  /**
   * ESC
   */

  /**
   * ESC D Index (IND is 0x84).
   */
  public index(): void {
    this.buffer.y++;
    if (this.buffer.y > this.buffer.scrollBottom) {
      this.buffer.y--;
      this.scroll();
    }
    // If the end of the line is hit, prevent this action from wrapping around to the next line.
    if (this.buffer.x >= this.cols) {
      this.buffer.x--;
    }
  }

  /**
   * ESC M Reverse Index (RI is 0x8d).
   *
   * Move the cursor up one row, inserting a new blank line if necessary.
   */
  public reverseIndex(): void {
    if (this.buffer.y === this.buffer.scrollTop) {
      // possibly move the code below to term.reverseScroll();
      // test: echo -ne '\e[1;1H\e[44m\eM\e[0m'
      // blankLine(true) is xterm/linux behavior
      const scrollRegionHeight = this.buffer.scrollBottom - this.buffer.scrollTop;
      this.buffer.lines.shiftElements(this.buffer.y + this.buffer.ybase, scrollRegionHeight, 1);
      this.buffer.lines.set(this.buffer.y + this.buffer.ybase, this.blankLine(true));
      this.updateRange(this.buffer.scrollTop);
      this.updateRange(this.buffer.scrollBottom);
    } else {
      this.buffer.y--;
    }
  }

  /**
   * ESC c Full Reset (RIS).
   */
  public reset(): void {
    this.options.rows = this.rows;
    this.options.cols = this.cols;
    const customKeyEventHandler = this.customKeyEventHandler;
    const inputHandler = this.inputHandler;
    const buffers = this.buffers;
    this.setup();
    this.customKeyEventHandler = customKeyEventHandler;
    this.inputHandler = inputHandler;
    this.buffers = buffers;
    this.refresh(0, this.rows - 1);
    this.viewport.syncScrollArea();
  }


  /**
   * ESC H Tab Set (HTS is 0x88).
   */
  private tabSet(): void {
    this.buffer.tabs[this.buffer.x] = true;
  }

  // TODO: Remove cancel function and cancelEvents option
  public cancel(ev: Event, force?: boolean): boolean {
    if (!this.options.cancelEvents && !force) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    return false;
  }

  // TODO: Remove when true color is implemented
  public matchColor(r1: number, g1: number, b1: number): number {
    return matchColor_(r1, g1, b1);
  }
}

/**
 * Helpers
 */

function globalOn(el: any, type: string, handler: (event: Event) => any, capture?: boolean): void {
  if (!Array.isArray(el)) {
    el = [el];
  }
  el.forEach((element: HTMLElement) => {
    element.addEventListener(type, handler, capture || false);
  });
}
// TODO: Remove once everything is typed
const on = globalOn;

function off(el: any, type: string, handler: (event: Event) => any, capture: boolean = false): void {
  el.removeEventListener(type, handler, capture);
}

function isThirdLevelShift(browser: IBrowser, ev: KeyboardEvent): boolean {
  const thirdLevelKey =
      (browser.isMac && ev.altKey && !ev.ctrlKey && !ev.metaKey) ||
      (browser.isMSWindows && ev.altKey && ev.ctrlKey && !ev.metaKey);

  if (ev.type === 'keypress') {
    return thirdLevelKey;
  }

  // Don't invoke for arrows, pageDown, home, backspace, etc. (on non-keypress events)
  return thirdLevelKey && (!ev.keyCode || ev.keyCode > 47);
}

/**
 * TODO:
 * The below color-related code can be removed when true color is implemented.
 * It's only purpose is to match true color requests with the closest matching
 * ANSI color code.
 */

// Colors 0-15 + 16-255
// Much thanks to TooTallNate for writing this.
const vcolors: number[][] = (function(): number[][] {
  const result = DEFAULT_ANSI_COLORS.map(c => {
    c = c.substring(1);
    return [
      parseInt(c.substring(0, 2), 16),
      parseInt(c.substring(2, 4), 16),
      parseInt(c.substring(4, 6), 16)
    ];
  });
  const r = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff];

  // 16-231
  for (let i = 0; i < 216; i++) {
    result.push([
      r[(i / 36) % 6 | 0],
      r[(i / 6) % 6 | 0],
      r[i % 6]
    ]);
  }

  // 232-255 (grey)
  let c: number;
  for (let i = 0; i < 24; i++) {
    c = 8 + i * 10;
    result.push([c, c, c]);
  }

  return result;
})();

const matchColorCache: {[colorRGBHash: number]: number} = {};

// http://stackoverflow.com/questions/1633828
function matchColorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.pow(30 * (r1 - r2), 2)
    + Math.pow(59 * (g1 - g2), 2)
    + Math.pow(11 * (b1 - b2), 2);
};


function matchColor_(r1: number, g1: number, b1: number): number {
  const hash = (r1 << 16) | (g1 << 8) | b1;

  if (matchColorCache[hash] != null) {
    return matchColorCache[hash];
  }

  let ldiff = Infinity;
  let li = -1;
  let i = 0;
  let c: number[];
  let r2: number;
  let g2: number;
  let b2: number;
  let diff: number;

  for (; i < vcolors.length; i++) {
    c = vcolors[i];
    r2 = c[0];
    g2 = c[1];
    b2 = c[2];

    diff = matchColorDistance(r1, g1, b1, r2, g2, b2);

    if (diff === 0) {
      li = i;
      break;
    }

    if (diff < ldiff) {
      ldiff = diff;
      li = i;
    }
  }

  return matchColorCache[hash] = li;
}

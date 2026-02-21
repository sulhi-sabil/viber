/**
 * CLI Output Formatting Utilities
 *
 * Provides consistent, readable output formatting for CLI applications.
 * Designed to work alongside the ConsoleLogger for enhanced developer experience.
 *
 * @module cli-output
 */

/**
 * Configuration options for CLI output formatting
 */
export interface CliOutputOptions {
  /** Enable ANSI color codes (auto-detected by default) */
  useColors?: boolean;
  /** Enable emoji prefixes (default: true) */
  useEmoji?: boolean;
  /** Maximum width for table columns (default: 40) */
  maxColumnWidth?: number;
  /** Indentation string (default: "  ") */
  indent?: string;
}

/**
 * Status type for formatStatus output
 */
export type StatusType = "success" | "error" | "warning" | "info" | "pending";

/**
 * Table column definition
 */
export interface TableColumn<T = unknown> {
  /** Column header label */
  header: string;
  /** Key to extract from row objects */
  key: string;
  /** Optional width override */
  width?: number;
  /** Optional alignment: 'left' | 'center' | 'right' */
  align?: "left" | "center" | "right";
  /** Optional formatter function */
  formatter?: (value: unknown, row: T) => string;
}

/**
 * Default CLI output configuration
 */
const DEFAULT_OPTIONS: Required<CliOutputOptions> = {
  useColors:
    typeof process !== "undefined" &&
    process.env?.NODE_ENV !== "production" &&
    (process.stdout?.isTTY ?? false),
  useEmoji: true,
  maxColumnWidth: 40,
  indent: "  ",
};

/**
 * ANSI color codes
 */
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  white: "\x1b[37m",
} as const;

/**
 * Status configuration with emoji and colors
 */
const STATUS_CONFIG: Record<
  StatusType,
  { emoji: string; label: string; color: string }
> = {
  success: { emoji: "✓", label: "SUCCESS", color: COLORS.green },
  error: { emoji: "✗", label: "ERROR", color: COLORS.red },
  warning: { emoji: "⚠", label: "WARNING", color: COLORS.yellow },
  info: { emoji: "ℹ", label: "INFO", color: COLORS.blue },
  pending: { emoji: "○", label: "PENDING", color: COLORS.cyan },
} as const;

/**
 * CLI Output Formatter Class
 *
 * Provides methods for formatting CLI output in a consistent, readable manner.
 * Supports colors, emoji, tables, lists, and status messages.
 *
 * @example
 * ```typescript
 * const formatter = new CliOutputFormatter({ useColors: true });
 *
 * // Format a table
 * console.log(formatter.formatTable([
 *   { name: "Alice", age: 30 },
 *   { name: "Bob", age: 25 }
 * ], ["name", "age"]));
 *
 * // Format a status message
 * console.log(formatter.formatStatus("Build completed", "success"));
 * ```
 */
export class CliOutputFormatter {
  private options: Required<CliOutputOptions>;

  constructor(options: CliOutputOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Apply color to text if colors are enabled
   */
  private color(text: string, colorCode: string): string {
    return this.options.useColors ? `${colorCode}${text}${COLORS.reset}` : text;
  }

  /**
   * Apply bold formatting if colors are enabled
   */
  private bold(text: string): string {
    return this.color(text, COLORS.bold);
  }

  /**
   * Apply dim formatting if colors are enabled
   */
  private dim(text: string): string {
    return this.color(text, COLORS.dim);
  }

  /**
   * Truncate string to max length with ellipsis
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + "...";
  }

  /**
   * Pad string to specified length with alignment
   */
  private pad(
    str: string,
    length: number,
    align: "left" | "center" | "right" = "left",
  ): string {
    const padding = Math.max(0, length - str.length);
    switch (align) {
      case "right":
        return " ".repeat(padding) + str;
      case "center":
        const left = Math.floor(padding / 2);
        const right = padding - left;
        return " ".repeat(left) + str + " ".repeat(right);
      default:
        return str + " ".repeat(padding);
    }
  }

  /**
   * Format data as an ASCII table
   *
   * @param data - Array of objects to display as table rows
   * @param columns - Column definitions or array of key names
   * @returns Formatted table string
   *
   * @example
   * ```typescript
   * formatter.formatTable(
   *   [{ name: "Alice", role: "Admin" }, { name: "Bob", role: "User" }],
   *   ["name", "role"]
   * );
   * ```
   */
  formatTable<T extends Record<string, unknown>>(
    data: T[],
    columns: (string | TableColumn<T>)[],
  ): string {
    if (data.length === 0) {
      return this.dim("(no data)");
    }

    // Normalize columns
    const tableColumns: TableColumn<T>[] = columns.map((col) =>
      typeof col === "string" ? { header: col, key: col } : col,
    );

    // Calculate column widths
    const widths: number[] = tableColumns.map((col) => {
      const headerWidth = col.header.length;
      const dataWidth = Math.max(
        ...data.map((row) => {
          const value = row[col.key];
          const formatted = col.formatter
            ? col.formatter(value, row)
            : String(value ?? "");
          return this.truncate(formatted, this.options.maxColumnWidth).length;
        }),
      );
      const colWidth = col.width ?? Math.max(headerWidth, dataWidth, 5);
      return Math.min(colWidth, this.options.maxColumnWidth);
    });

    // Build header
    const headerCells = tableColumns.map((col, index) => {
      const header = this.bold(this.pad(col.header, widths[index], col.align));
      return ` ${header} `;
    });

    // Build separator
    const separator = tableColumns
      .map((_, index) => "-".repeat(widths[index] + 2))
      .join("+");

    const separatorLine = `+${separator}+`;

    // Build rows
    const rows = data.map((row) => {
      const cells = tableColumns.map((col, index) => {
        const value = row[col.key];
        const formatted = col.formatter
          ? col.formatter(value, row)
          : String(value ?? "");
        const truncated = this.truncate(formatted, this.options.maxColumnWidth);
        const padded = this.pad(truncated, widths[index], col.align);
        return ` ${padded} `;
      });
      return `|${cells.join("|")}|`;
    });

    // Assemble table
    const lines = [
      separatorLine,
      `|${headerCells.join("|")}|`,
      separatorLine,
      ...rows,
      separatorLine,
    ];

    return lines.join("\n");
  }

  /**
   * Format items as a bullet list
   *
   * @param items - Array of strings or objects to format
   * @param options - Optional styling options
   * @returns Formatted list string
   *
   * @example
   * ```typescript
   * formatter.formatList(["Item 1", "Item 2", "Item 3"]);
   * // • Item 1
   * // • Item 2
   * // • Item 3
   * ```
   */
  formatList(
    items: string[],
    options?: { bullet?: string; indent?: string; color?: string },
  ): string {
    const bullet = options?.bullet ?? (this.options.useEmoji ? "•" : "-");
    const indent = options?.indent ?? this.options.indent;

    return items
      .map((item) => {
        const coloredBullet = options?.color
          ? this.color(bullet, options.color)
          : bullet;
        return `${indent}${coloredBullet} ${item}`;
      })
      .join("\n");
  }

  /**
   * Format key-value pairs for display
   *
   * @param data - Object with key-value pairs
   * @param options - Optional styling options
   * @returns Formatted key-value string
   *
   * @example
   * ```typescript
   * formatter.formatKeyValue({ name: "Alice", age: 30 });
   * // name: Alice
   * //  age: 30
   * ```
   */
  formatKeyValue(
    data: Record<string, unknown>,
    options?: { indent?: string; keyColor?: string; separator?: string },
  ): string {
    const indent = options?.indent ?? this.options.indent;
    const separator = options?.separator ?? ":";

    const entries = Object.entries(data);
    if (entries.length === 0) {
      return this.dim("(empty)");
    }

    // Find max key length for alignment
    const maxKeyLength = Math.max(...entries.map(([key]) => key.length));

    return entries
      .map(([key, value]) => {
        const formattedKey = this.pad(key, maxKeyLength);
        const coloredKey = options?.keyColor
          ? this.color(formattedKey, options.keyColor)
          : this.bold(formattedKey);
        const formattedValue =
          typeof value === "object" ? JSON.stringify(value) : String(value);
        return `${indent}${coloredKey}${separator} ${formattedValue}`;
      })
      .join("\n");
  }

  /**
   * Create a visual divider line
   *
   * @param options - Optional styling options
   * @returns Formatted divider string
   *
   * @example
   * ```typescript
   * console.log(formatter.formatDivider());
   * // ─────────────────────────────────────────
   *
   * console.log(formatter.formatDivider({ label: "Section" }));
   * // ──────────── Section ────────────────────
   * ```
   */
  formatDivider(options?: {
    width?: number;
    char?: string;
    label?: string;
    color?: string;
  }): string {
    const width = options?.width ?? 40;
    const char = options?.char ?? "─";

    if (options?.label) {
      const label = ` ${options.label} `;
      const labelLength = label.length;
      const sideWidth = Math.floor((width - labelLength) / 2);
      const left = char.repeat(Math.max(0, sideWidth));
      const right = char.repeat(Math.max(0, width - sideWidth - labelLength));
      const line = left + label + right;

      return options.color ? this.color(line, options.color) : this.dim(line);
    }

    const line = char.repeat(width);
    return options?.color ? this.color(line, options.color) : this.dim(line);
  }

  /**
   * Format a status message with emoji and color
   *
   * @param message - The status message
   * @param type - Status type (success, error, warning, info, pending)
   * @returns Formatted status string
   *
   * @example
   * ```typescript
   * console.log(formatter.formatStatus("Build completed", "success"));
   * // ✓ Build completed
   *
   * console.log(formatter.formatStatus("Tests failed", "error"));
   * // ✗ Tests failed
   * ```
   */
  formatStatus(message: string, type: StatusType): string {
    const config = STATUS_CONFIG[type];
    const emoji = this.options.useEmoji
      ? `${config.emoji} `
      : `[${config.label}] `;

    if (this.options.useColors) {
      return `${this.color(emoji, config.color)}${message}`;
    }
    return `${emoji}${message}`;
  }

  /**
   * Format a message in a box
   *
   * @param message - The message to box
   * @param options - Optional styling options
   * @returns Formatted box string
   *
   * @example
   * ```typescript
   * console.log(formatter.formatBox("Hello, World!"));
   * // ╔═══════════════════╗
   * // ║ Hello, World!     ║
   * // ╚═══════════════════╝
   * ```
   */
  formatBox(
    message: string,
    options?: { width?: number; title?: string; borderColor?: string },
  ): string {
    const width = options?.width ?? Math.max(message.length + 4, 20);
    const innerWidth = width - 2;

    const lines: string[] = [];

    // Top border
    const topBorder = `╔${"═".repeat(innerWidth)}╗`;
    lines.push(
      options?.borderColor
        ? this.color(topBorder, options.borderColor)
        : topBorder,
    );

    // Title if provided
    if (options?.title) {
      const titleLine = `║ ${this.bold(this.pad(options.title, innerWidth - 2))} ║`;
      lines.push(
        options?.borderColor
          ? this.color(titleLine, options.borderColor)
          : titleLine,
      );
      const separatorLine = `╠${"═".repeat(innerWidth)}╣`;
      lines.push(
        options?.borderColor
          ? this.color(separatorLine, options.borderColor)
          : separatorLine,
      );
    }

    // Message
    const messageLine = `║ ${this.pad(message, innerWidth - 2)} ║`;
    lines.push(
      options?.borderColor
        ? this.color(messageLine, options.borderColor)
        : messageLine,
    );

    // Bottom border
    const bottomBorder = `╚${"═".repeat(innerWidth)}╝`;
    lines.push(
      options?.borderColor
        ? this.color(bottomBorder, options.borderColor)
        : bottomBorder,
    );

    return lines.join("\n");
  }

  /**
   * Format a simple text with optional styling
   *
   * @param text - Text to format
   * @param style - Style to apply (bold, dim, green, red, etc.)
   * @returns Formatted text
   */
  formatText(text: string, style: keyof typeof COLORS): string {
    return this.color(text, COLORS[style]);
  }

  /**
   * Format multiple lines with line numbers
   *
   * @param lines - Array of strings or single string with newlines
   * @param options - Optional styling options
   * @returns Formatted lines with numbers
   */
  formatNumberedLines(
    lines: string | string[],
    options?: { startNumber?: number; dimNumbers?: boolean },
  ): string {
    const lineArray = Array.isArray(lines) ? lines : lines.split("\n");
    const startNumber = options?.startNumber ?? 1;
    const maxDigits = String(startNumber + lineArray.length - 1).length;

    return lineArray
      .map((line, index) => {
        const num = String(startNumber + index).padStart(maxDigits);
        const formattedNum = options?.dimNumbers ? this.dim(num) : num;
        return `${formattedNum} | ${line}`;
      })
      .join("\n");
  }
}

/**
 * Default CLI output formatter instance
 */
export const cliOutput = new CliOutputFormatter();

/**
 * Convenience functions using the default formatter
 */
export const formatTable = <T extends Record<string, unknown>>(
  data: T[],
  columns: (string | TableColumn<T>)[],
): string => cliOutput.formatTable(data, columns);

export const formatList = (
  items: string[],
  options?: { bullet?: string; indent?: string; color?: string },
): string => cliOutput.formatList(items, options);

export const formatKeyValue = (
  data: Record<string, unknown>,
  options?: { indent?: string; keyColor?: string; separator?: string },
): string => cliOutput.formatKeyValue(data, options);

export const formatDivider = (options?: {
  width?: number;
  char?: string;
  label?: string;
  color?: string;
}): string => cliOutput.formatDivider(options);

export const formatStatus = (message: string, type: StatusType): string =>
  cliOutput.formatStatus(message, type);

export const formatBox = (
  message: string,
  options?: { width?: number; title?: string; borderColor?: string },
): string => cliOutput.formatBox(message, options);

export const formatText = (text: string, style: keyof typeof COLORS): string =>
  cliOutput.formatText(text, style);

export const formatNumberedLines = (
  lines: string | string[],
  options?: { startNumber?: number; dimNumbers?: boolean },
): string => cliOutput.formatNumberedLines(lines, options);

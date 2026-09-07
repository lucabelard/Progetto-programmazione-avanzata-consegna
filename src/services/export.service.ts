import PDFDocument from 'pdfkit';

/**
 * ExportService – genera esportazioni in formato JSON o PDF.
 *
 * Usato principalmente per esportare la lista delle richieste di aggiornamento,
 * ma può essere usato per qualsiasi dato strutturato.
 *
 * Le specifiche richiedono che entrambi i formati siano implementati.
 */
export class ExportService {

  /**
   * Esporta i dati in formato JSON.
   * Ritorna una stringa JSON formattata per leggibilità.
   */
  toJSON(data: unknown): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Genera un PDF a partire dai dati delle richieste di aggiornamento.
   *
   * Il PDF contiene:
   *   - Intestazione con titolo e data di generazione
   *   - Tabella (simulata con testo formattato) delle richieste
   *   - Per ogni richiesta: ID, stato, data, proponente, celle modificate
   *
   * @param title   Titolo del documento
   * @param data    Array di oggetti da serializzare nel PDF
   * @returns       Buffer con il contenuto del PDF
   */
  async toPDF(title: string, data: Record<string, unknown>[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      //il pdf non viene generato tutto insieme ma a chunks,
      //questo serve per non bloccare il server nel caso in cui il pdf sia molto grande
      const chunks: Buffer[] = [];

      //event listener dello stream
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      // ── Intestazione ──────────────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(18).text(title, { align: 'center' });
      doc.moveDown(0.5);

      doc.font('Helvetica').fontSize(10)
        .fillColor('gray')
        .text(`Generato il: ${new Date().toLocaleString('it-IT')}`, { align: 'center' });

      doc.moveDown(1);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.5);

      if (data.length === 0) {
        doc.font('Helvetica').fontSize(12).fillColor('black').text('Nessun dato disponibile.');
        doc.end();
        return;
      }

      // ── Corpo del documento ───────────────────────────────────────────────
      data.forEach((item, index) => {
        doc.font('Helvetica-Bold').fontSize(12).fillColor('black')
          .text(`Record #${index + 1}`, { underline: true });
        doc.moveDown(0.3);

        // Serializza ogni campo dell'oggetto
        Object.entries(item).forEach(([key, value]) => {
          const label = this.formatFieldName(key);
          const content = this.formatFieldValue(value);

          doc.font('Helvetica-Bold').fontSize(10).text(`${label}: `, { continued: true });
          doc.font('Helvetica').fontSize(10).text(content);
        });

        doc.moveDown(0.8);

        // Linea separatrice tra i record
        if (index < data.length - 1) {
          doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#eeeeee').stroke();
          doc.moveDown(0.5);
        }
      });

      // ── Piè di pagina ─────────────────────────────────────────────────────
      doc.moveDown(1);
      doc.font('Helvetica').fontSize(9).fillColor('gray')
        .text(`Totale record: ${data.length}`, { align: 'right' });

      doc.end();
    });
  }

  /** Converte un nome di campo camelCase in etichetta leggibile */
  private formatFieldName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /** Converte un valore in stringa leggibile */
  private formatFieldValue(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (value instanceof Date) return value.toLocaleString('it-IT');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}

export const exportService = new ExportService();

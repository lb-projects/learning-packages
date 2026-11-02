/**
 * @file xml-utils.js
 * @description Abgesichertes Einlesen von XML-Dokumenten aus XLSX- und ODS-Dateien.
 *
 * Zweck:
 *   Gemeinsame Hilfsfunktionen für xlsx-parser.js und ods-parser.js.
 *
 * Abhängigkeiten:
 *   Keine (Browser-API DOMParser).
 *
 * Sicherheitsaspekte:
 *   - DOMParser mit dem Typ "application/xml" erzeugt ein reines Datendokument:
 *     Skripte darin werden nicht ausgeführt, externe Ressourcen nicht geladen,
 *     und das Dokument wird nie in die Seite eingefügt.
 *   - Dokumente mit DOCTYPE- oder ENTITY-Deklarationen werden vorab abgelehnt.
 *     Tabellendokumente benötigen diese nie; sie wären aber das Mittel für
 *     Angriffe wie "Billion Laughs" (exponentielle Entitäten-Expansion).
 *   - Trusted Types: Die Content-Security-Policy (index.html) verlangt für
 *     DOMParser.parseFromString ein TrustedHTML-Objekt. Dafür wird hier die
 *     einzige erlaubte Policy "knn-xml" angelegt. Das Policy-Objekt bleibt in
 *     dieser Funktion eingeschlossen (nicht über den Namensraum erreichbar),
 *     und die CSP erlaubt keinen zweiten Policy-Namen und kein erneutes Anlegen.
 *     Andere Programmteile können daher keine Zeichenkette in eine HTML-Senke
 *     (innerHTML usw.) schleusen. Das Ergebnis von parseFromString ist ein
 *     inertes XML-Dokument, das nie in die Seite eingefügt wird.
 */
(function (ns) {
  'use strict';

  /**
   * Private Trusted-Types-Policy (nur in Browsern mit Trusted Types; sonst null).
   * createHTML gibt den Text unverändert weiter – zulässig, weil er ausschließlich
   * an parseXml übergeben wird, das ihn vorher prüft und als XML (nicht HTML) parst.
   */
  const xmlPolicy = window.trustedTypes && typeof window.trustedTypes.createPolicy === 'function'
    ? window.trustedTypes.createPolicy('knn-xml', { createHTML: (text) => text })
    : null;

  /**
   * Parst einen XML-Text.
   *
   * @param {string} text - XML-Quelltext.
   * @param {string} name - Name des Archiveintrags (nur für Fehlermeldungen).
   * @returns {Document} Das geparste XML-Dokument.
   * @throws {Error} Bei DOCTYPE/ENTITY-Deklarationen oder fehlerhaftem XML.
   */
  function parseXml(text, name) {
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
      throw new Error('Ungültige oder nicht unterstützte Datei: ' + name +
        ' enthält unzulässige DOCTYPE-/ENTITY-Deklarationen.');
    }
    const source = xmlPolicy ? xmlPolicy.createHTML(text) : text;
    const doc = new DOMParser().parseFromString(source, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Ungültige oder nicht unterstützte Datei: ' + name + ' ist kein gültiges XML.');
    }
    return doc;
  }

  /**
   * Liefert alle Nachfahren mit dem angegebenen lokalen Namen – unabhängig vom
   * Namensraum (Excel verwendet je nach Version unterschiedliche Namensräume).
   *
   * @param {Document|Element} root - Ausgangsknoten.
   * @param {string} localName - Lokaler Elementname, z. B. "row".
   * @returns {Element[]} Gefundene Elemente in Dokumentreihenfolge.
   */
  function descendants(root, localName) {
    return Array.from(root.getElementsByTagNameNS('*', localName));
  }

  /**
   * Liefert die direkten Kindelemente mit dem angegebenen lokalen Namen.
   *
   * @param {Element} parent - Elternelement.
   * @param {string} localName - Lokaler Elementname.
   * @returns {Element[]} Gefundene Kindelemente.
   */
  function children(parent, localName) {
    return Array.from(parent.children).filter((c) => c.localName === localName);
  }

  /**
   * Liest ein Attribut anhand seines lokalen Namens; der Namensraum wird
   * ignoriert (z. B. "r:id" → lokaler Name "id").
   *
   * @param {Element} element - Element.
   * @param {string} localName - Lokaler Attributname.
   * @param {boolean} [namespacedOnly=false] - Nur Attribute mit Namensraum berücksichtigen.
   * @returns {string|null} Attributwert oder null.
   */
  function attr(element, localName, namespacedOnly) {
    for (const a of Array.from(element.attributes)) {
      if (a.localName === localName && (!namespacedOnly || a.namespaceURI)) {
        return a.value;
      }
    }
    return null;
  }

  ns.xml = { parseXml, descendants, children, attr };
})(window.KNN = window.KNN || {});

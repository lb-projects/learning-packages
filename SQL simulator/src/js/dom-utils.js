/**
 * @file dom-utils.js
 * @description Sichere Hilfsfunktionen zum Erzeugen und Bearbeiten von DOM-Elementen.
 *
 * Zweck:
 *   Alle anderen Module erzeugen ihre Oberfläche ausschließlich über diese
 *   Funktionen. Dadurch gibt es genau eine Stelle, an der festgelegt ist, wie
 *   Elemente, Attribute und Texte in die Seite gelangen.
 *
 * Abhängigkeiten:
 *   Keine (nur Standard-DOM-API des Browsers).
 *
 * Sicherheitsaspekte:
 *   - Texte werden ausschließlich über Textknoten (`document.createTextNode`)
 *     bzw. `textContent` eingefügt. Dadurch wird jeglicher Inhalt – auch
 *     Zeichenketten wie `<script>` oder `<img onerror=…>` aus hochgeladenen
 *     SQL-Dateien – nur als Text dargestellt und niemals als HTML interpretiert.
 *   - HTML-Senken (Zuweisungen von HTML-Text an Elemente) und das direkte
 *     Schreiben ins Dokument werden im gesamten Projekt nicht verwendet;
 *     der Build prüft das.
 *   - Attributnamen, die mit "on" beginnen (Event-Handler), sowie die
 *     Attribute "style" und "srcdoc" werden abgelehnt.
 *   - URL-Attribute (href, src, …) dürfen kein Schema wie "javascript:" enthalten.
 */
(function (ns) {
  'use strict';

  /** Attribute, die eine Adresse enthalten können. */
  const URL_ATTRIBUTES = new Set(['href', 'xlink:href', 'src', 'action', 'formaction', 'data', 'poster', 'background']);

  /**
   * Prüft, ob ein Attribut gesetzt werden darf.
   *
   * @param {string} name - Name des Attributs.
   * @param {*} value - Vorgesehener Wert.
   * @throws {Error} Wenn Attributname oder -wert unzulässig ist.
   */
  function assertSafeAttribute(name, value) {
    const lower = String(name).toLowerCase();
    if (lower.startsWith('on') || lower === 'style' || lower === 'srcdoc') {
      throw new Error('Unzulässiges Attribut: ' + name);
    }
    if (URL_ATTRIBUTES.has(lower)) {
      // Steuer- und Leerzeichen entfernen, die Browser beim Auswerten ebenfalls ignorieren.
      const url = String(value).replace(/[\u0000- \u007f-\u009f]/g, '');
      // Erlaubt: "#anker" oder relative Pfade ohne Schema.
      if (!/^#/.test(url) && /^[^/?#]*:/.test(url)) {
        throw new Error('Unzulässige Adresse im Attribut ' + name);
      }
    }
  }

  /**
   * Hängt Kindelemente bzw. Texte an ein Element an.
   * Zeichenketten und Zahlen werden immer als Textknoten eingefügt.
   *
   * @param {Node} parent - Element, an das angehängt wird.
   * @param {Array|Node|string|number|null|undefined} children - Kind(er); null/undefined/false werden ignoriert.
   */
  function appendChildren(parent, children) {
    if (children === null || children === undefined || children === false) {
      return;
    }
    const list = Array.isArray(children) ? children : [children];
    for (const child of list) {
      if (child === null || child === undefined || child === false) {
        continue;
      }
      if (typeof child === 'string' || typeof child === 'number') {
        parent.appendChild(document.createTextNode(String(child)));
      } else {
        parent.appendChild(child);
      }
    }
  }

  /**
   * Setzt Attribute auf einem Element.
   * "class" ist eine Leerzeichen-getrennte Klassenliste; `true` setzt ein
   * boolesches Attribut ohne Wert, `false`/null/undefined lassen es weg.
   *
   * @param {Element} element - Zielelement.
   * @param {Object<string, *>} attrs - Attribute als Schlüssel/Wert-Paare (feste Namen aus dem Programmcode).
   * @throws {Error} Bei unzulässigen Attributnamen.
   */
  function setAttributes(element, attrs) {
    if (!attrs) {
      return;
    }
    for (const name of Object.keys(attrs)) {
      const value = attrs[name];
      assertSafeAttribute(name, value);
      if (value === false || value === null || value === undefined) {
        continue;
      }
      element.setAttribute(name, value === true ? '' : String(value));
    }
  }

  /**
   * Erzeugt ein HTML-Element.
   *
   * @example
   *   el('button', { type: 'button', class: 'btn' }, 'Laden');
   *
   * @param {string} tag - Tag-Name, z. B. "div".
   * @param {Object<string, *>} [attrs] - Attribute (siehe {@link setAttributes}).
   * @param {Array|Node|string|number} [children] - Kindelemente oder Text.
   * @returns {HTMLElement} Das neue Element.
   */
  function el(tag, attrs, children) {
    const element = document.createElement(tag);
    setAttributes(element, attrs);
    appendChildren(element, children);
    return element;
  }

  /**
   * Entfernt alle Kindknoten eines Elements.
   *
   * @param {Node} element - Element, das geleert wird.
   * @returns {Node} Dasselbe Element (für Verkettung).
   */
  function clear(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
    return element;
  }

  /**
   * Holt ein Element über seine ID und bricht mit einer klaren Meldung ab,
   * wenn es fehlt (Programmierfehler im HTML-Gerüst).
   *
   * @param {string} id - ID des Elements.
   * @returns {HTMLElement} Das gefundene Element.
   * @throws {Error} Wenn kein Element mit dieser ID existiert.
   */
  function byId(id) {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error('Element nicht gefunden: #' + id);
    }
    return element;
  }

  /** Zahlformat für Mengenangaben in Fließtexten (deutsche Schreibweise, z. B. "1.250"). */
  const countFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

  /**
   * Formatiert eine Anzahl mit Tausenderpunkten.
   *
   * @param {number} value - Anzahl.
   * @returns {string} z. B. "20.000".
   */
  function formatCount(value) {
    return countFormat.format(value);
  }

  /**
   * Gibt "1 Zeile" bzw. "3 Zeilen" zurück.
   *
   * @param {number} count - Anzahl.
   * @param {string} singular - Einzahl, z. B. "Zeile".
   * @param {string} plural - Mehrzahl, z. B. "Zeilen".
   * @returns {string} Text mit Anzahl.
   */
  function plural(count, singular, plural) {
    return formatCount(count) + ' ' + (count === 1 ? singular : plural);
  }

  ns.dom = { el, clear, byId, appendChildren, setAttributes, formatCount, plural };
})(window.SQLSIM = window.SQLSIM || {});

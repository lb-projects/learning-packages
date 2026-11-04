// Kopie aus shared/js/dom-utils.js – nicht hier bearbeiten: Änderungen in shared/ vornehmen und sync-shared.mjs ausführen.
/**
 * @file dom-utils.js
 * @description Sichere Hilfsfunktionen zum Erzeugen und Bearbeiten von DOM-Elementen.
 *
 * Zweck:
 *   Alle anderen Module erzeugen ihre Oberfläche ausschließlich über diese
 *   Funktionen. Dadurch gibt es genau eine Stelle, an der festgelegt ist, wie
 *   Elemente, Attribute und Texte in die Seite gelangen.
 *
 * Gemeinsamer Code der Lernpakete (Quelle: shared/js/dom-utils.js).
 *
 * Abhängigkeiten:
 *   Keine (nur Standard-DOM-API des Browsers).
 *
 * Sicherheitsaspekte:
 *   - Texte werden ausschließlich als Textknoten (`Element.append` mit
 *     Zeichenkette) bzw. über `textContent` eingefügt. Dadurch wird jeglicher Inhalt – auch
 *     Zeichenketten wie `<script>` oder `<img onerror=…>` aus hochgeladenen
 *     Dateien – nur als Text dargestellt und niemals als HTML interpretiert.
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
   * Nur echte DOM-Knoten werden unverändert eingefügt; alles andere (Zeichenketten,
   * Zahlen, Fehlerobjekte …) wird immer als Textknoten eingefügt.
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
      // append() fügt Zeichenketten immer als Textknoten ein; alles, was kein Knoten ist, wird zu Text.
      parent.append(child instanceof Node ? child : String(child));
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

  /** Namensraum für SVG-Elemente (nur ein Bezeichner, es wird nichts geladen). */
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /**
   * Erzeugt ein SVG-Element (z. B. für das Klassendiagramm).
   * Es gelten dieselben Attributprüfungen wie bei {@link el}; Texte werden als Textknoten eingefügt.
   *
   * @param {string} tag - Tag-Name, z. B. "rect".
   * @param {Object<string, *>} [attrs] - Attribute.
   * @param {Array|Node|string|number} [children] - Kindelemente oder Text.
   * @returns {SVGElement} Das neue Element.
   */
  function svg(tag, attrs, children) {
    const element = document.createElementNS(SVG_NS, tag);
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

  // Paketeigene Formatierer (z. B. formatNumber, plural) ergänzt js/format-utils.js im jeweiligen Paket.
  ns.dom = Object.assign(ns.dom || {}, { el, svg, clear, byId, appendChildren, setAttributes, SVG_NS });
})(window.HG = window.HG || {});

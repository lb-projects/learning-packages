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
 *     Dateien – nur als Text dargestellt und niemals als HTML interpretiert.
 *   - `innerHTML`, `outerHTML`, `insertAdjacentHTML` und `document.write`
 *     werden im gesamten Projekt nicht verwendet.
 *   - Attributnamen, die mit "on" beginnen (Event-Handler), sowie das
 *     Attribut "style" werden abgelehnt. So kann selbst durch einen
 *     Programmierfehler kein Inline-Code oder Inline-Stil entstehen, der
 *     zudem von der Content-Security-Policy blockiert würde.
 *   - URL-Attribute (href, src, …) dürfen kein Schema wie "javascript:" enthalten.
 */
(function (ns) {
  'use strict';

  /** XML-Namensraum für SVG-Elemente (reiner Bezeichner, es wird nichts geladen). */
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /** Attribute, deren Wert als URL ausgewertet wird (könnten "javascript:" ausführen). */
  const URL_ATTRIBUTES = new Set(['href', 'xlink:href', 'src', 'action', 'formaction', 'data', 'poster', 'background']);

  /**
   * Prüft, ob ein Attribut gesetzt werden darf.
   * Verboten sind Event-Handler-Attribute (onclick, onerror, …), "style",
   * "srcdoc" sowie URL-Attribute mit einem anderen Schema als einer relativen
   * Adresse oder "#…" (insbesondere javascript:, data:, vbscript:).
   * Das Paket setzt derzeit keine URL-Attribute; die Prüfung schützt vor
   * Fehlern in künftigem Code.
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
      const url = String(value).replace(/[\u0000-\u0020\u007f-\u009f]/g, '');
      // Erlaubt: "#anker" oder relative Pfade ohne Schema (kein ":" vor dem ersten "/", "?" oder "#").
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
   * @param {Array<Node|string|number|null|undefined>|Node|string|number|null|undefined} children
   *        Einzelnes Kind oder Liste von Kindern; null/undefined werden ignoriert.
   */
  function appendChildren(parent, children) {
    if (children === null || children === undefined) {
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
   * Sonderfälle:
   *   - "class": Klassenliste (String, Leerzeichen-getrennt).
   *   - Wert `true` setzt ein boolesches Attribut ohne Wert, `false`/null/undefined
   *     lassen das Attribut weg.
   *
   * @param {Element} element - Zielelement.
   * @param {Object<string, *>} attrs - Attribute als Schlüssel/Wert-Paare.
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
      if (value === true) {
        element.setAttribute(name, '');
      } else {
        element.setAttribute(name, String(value));
      }
    }
  }

  /**
   * Erzeugt ein HTML-Element.
   *
   * @example
   *   el('button', { type: 'button', class: 'btn' }, 'Speichern');
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
   * Erzeugt ein SVG-Element im SVG-Namensraum.
   *
   * @param {string} tag - SVG-Tag-Name, z. B. "circle".
   * @param {Object<string, *>} [attrs] - Attribute (siehe {@link setAttributes}).
   * @param {Array|Node|string|number} [children] - Kindelemente oder Text.
   * @returns {SVGElement} Das neue SVG-Element.
   */
  function svgEl(tag, attrs, children) {
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

  /** Zahlformat für die Anzeige (deutsche Schreibweise, höchstens 3 Nachkommastellen). */
  const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 });

  /** Prozentformat (deutsche Schreibweise, höchstens 1 Nachkommastelle). */
  const percentFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

  /**
   * Formatiert eine Zahl in deutscher Schreibweise (Dezimalkomma).
   *
   * @param {number} value - Zahl.
   * @returns {string} Formatierte Zahl, z. B. "2,5".
   */
  function formatNumber(value) {
    return numberFormat.format(value);
  }

  /**
   * Formatiert einen Anteil (0 … 1) als Prozentangabe.
   *
   * @param {number} ratio - Anteil zwischen 0 und 1.
   * @returns {string} z. B. "62,5 %".
   */
  function formatPercent(ratio) {
    return percentFormat.format(ratio * 100) + ' %';
  }

  /**
   * Erzeugt die Kurzbeschreibung eines Datenpunkts, z. B. "#3 (2 | 4,5) Apfel".
   *
   * @param {{id:number, x:number, y:number, label:string}} point - Datenpunkt.
   * @returns {string} Beschreibung als reiner Text.
   */
  function describePoint(point) {
    return '#' + point.id + ' (' + formatNumber(point.x) + ' | ' + formatNumber(point.y) + ') ' + point.label;
  }

  ns.dom = {
    SVG_NS,
    el,
    svgEl,
    clear,
    byId,
    appendChildren,
    setAttributes,
    formatNumber,
    formatPercent,
    describePoint
  };
})(window.KNN = window.KNN || {});

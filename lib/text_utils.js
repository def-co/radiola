"use strict";

/*
  // within https://dev.w3.org/html5/html-author/charref do this:

  let rows = Array.prototype.slice.call(document.querySelectorAll('tr')),
      items = { };
  rows.forEach((row) => {
    let char = row.querySelector('td.character').textContent.slice(1),
        names = row.querySelector('td.named > code').textContent;
    names.split(' ').forEach((name) => {
      items[name.slice(1, -1)] = char;
    });
  });
  copy(JSON.stringify(items));
*/
const entities = require('./text_utils/html_entities.json');

const HTML_ENTITY_REGEX = /&(#?[A-Za-z0-9]+);/g;

exports.decodeHTMLEntities = (str) => {
  return str.replace(HTML_ENTITY_REGEX, (_match, entity) => {
    if (entity[0] === '#') {
      let num;
      if (entity[1] === 'x') {
        num = parseInt(entity.slice(2), 16);
      } else {
        num = parseInt(entity.slice(1), 10);
      }
      if (isNaN(num)) {
        throw new Error(`Invalid numeric entity: ${match}`);
      }
      return String.fromCodePoint(num);
    }

    return entities[entity];
  });
}

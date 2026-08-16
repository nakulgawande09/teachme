/** Tiny DOM helpers. No framework, no reconciler. */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * Required element lookup. A missing id is a build error, not a runtime
 * condition to branch on — fail loudly at boot rather than silently later.
 */
export function need(id, root = document) {
  const el = root.getElementById ? root.getElementById(id) : root.querySelector(`#${id}`);
  if (!el) throw new Error(`dom: required element #${id} is missing`);
  return el;
}

/**
 * Write an attribute only when it actually changes.
 * Re-writing an unchanged attribute restarts CSS transitions and animations,
 * which is exactly the bug that makes state-driven CSS feel janky.
 */
export function setAttr(el, name, value) {
  if (!el) return;
  if (value === null || value === undefined || value === false || value === '') {
    if (el.hasAttribute(name)) el.removeAttribute(name);
    return;
  }
  const next = String(value);
  if (el.getAttribute(name) !== next) el.setAttribute(name, next);
}

/** Bulk form of setAttr. */
export function setAttrs(el, attrs) {
  for (const name in attrs) setAttr(el, name, attrs[name]);
}

/** Write a CSS custom property only when it changes. */
export function setVar(el, name, value) {
  if (!el) return;
  const next = value === null || value === undefined ? '' : String(value);
  if (el.style.getPropertyValue(name) !== next) el.style.setProperty(name, next);
}

export function setVars(el, vars) {
  for (const name in vars) setVar(el, name, vars[name]);
}

/** Write text only when it changes. */
export function setText(el, value) {
  if (!el) return;
  const next = value === null || value === undefined ? '' : String(value);
  if (el.textContent !== next) el.textContent = next;
}

/** Write innerHTML only when it changes. Callers own the trust of `html`. */
export function setHTML(el, html) {
  if (!el) return;
  const next = html === null || html === undefined ? '' : String(html);
  if (el.innerHTML !== next) el.innerHTML = next;
}

/** Build an element in one call. */
export function el(tag, attrs = {}, html = '') {
  const node = document.createElement(tag);
  for (const name in attrs) {
    const v = attrs[name];
    if (v !== null && v !== undefined && v !== false) node.setAttribute(name, String(v));
  }
  if (html) node.innerHTML = html;
  return node;
}

/** Replace children in one reflow. */
export function replaceChildren(parent, nodes) {
  if (!parent) return;
  const frag = document.createDocumentFragment();
  for (const n of nodes) frag.appendChild(n);
  parent.replaceChildren(frag);
}

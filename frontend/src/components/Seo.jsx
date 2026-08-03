import { useEffect } from 'react';

function setMeta(attr, key, value) {
  let el = document.head.querySelector(`${attr}[${key}="${value}"]`);
  if (el) return;
  el = document.createElement(attr);
  el.setAttribute(key, value);
  document.head.appendChild(el);
}

function setPropertyMeta(property, content) {
  setMeta('meta', 'property', property);
  document.head.querySelector(`meta[property="${property}"]`).setAttribute('content', content);
}

function setNameMeta(name, content) {
  setMeta('meta', 'name', name);
  document.head.querySelector(`meta[name="${name}"]`).setAttribute('content', content);
}

export default function Seo({ title, description, type = 'website' }) {
  useEffect(() => {
    document.title = title;
    setNameMeta('description', description);
    setPropertyMeta('og:title', title);
    setPropertyMeta('og:description', description);
    setPropertyMeta('og:type', type);
  }, [title, description, type]);
  return null;
}

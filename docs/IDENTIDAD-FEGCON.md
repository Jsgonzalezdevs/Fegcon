# Identidad original de FEGCON

Los archivos se obtuvieron del sitio oficial de FEGCON el 5 de noviembre de 2026:

- Logo horizontal: https://www.fegcon.com.co/images/LOGO.jpg → `public/brand/fegcon-original.jpg` (480 × 248 px).
- Ícono oficial: https://www.fegcon.com.co/images/LOGO%20%20AJUSTADO%20%20FEGCON-modified.ico → `public/favicon.ico`.

Son los archivos originales, sin filtros, redibujo, recorte ni modificación de colores. El componente `BrandLogo` conserva la relación de aspecto e incluye texto alternativo. En superficies oscuras se muestra sobre blanco para preservar el arte original.

El acceso, la pantalla de error de conexión, el menú y la galería local usan el mismo componente. El navegador usa el ícono oficial. La compilación estática copia `public/` al paquete de cPanel y el verificador compara los archivos publicados con los originales locales.

# Herosaver

Methodology to Save Configuration and STLs from websites using the THREE.JS framework for academic and educational purposes.

Please **Always** think about the **developers** of such websites and try to **support them whenever possible**, as without them, there would be no such tools.

This is based on some ideas from [TeaWithLucas](https://github.com/TeaWithLucas), with a focus on making UI lighter & code simpler. It had some issues exporting the current format, so I modernized it a bit, and made it work with current site.

## Usage

### Bookmarklet

You can drag these to your bookmark-bar:

- [Hero STL](javascript:(() => fetch('https://raw.githubusercontent.com/notnullgames/Herosaver/master/dist/herosaver.js').then(r => r.text()).then(eval).then(() => saveStl()))())
- [Hero OBJ](javascript:(() => fetch('https://raw.githubusercontent.com/notnullgames/Herosaver/master/dist/herosaver.js').then(r => r.text()).then(eval).then(() => saveObj()))())


Go to the page and click the bookmarklet, and it will save the file for you.


### Browser Console

You can also use the developer-console, if you like.

  1. Go to the intended website
  2. Open the Javascript Console [F12], then click on Console
  3. Paste the following

```js
// code-loader
g = u => fetch(u || 'https://raw.githubusercontent.com/notnullgames/Herosaver/master/dist/herosaver.js').then(r => r.text()).then(eval)

// get STL file
g().then(() => saveStl())

// get OBJ file
g().then(() => saveObj())

// or
// subdivide 2 (increase smoothing quality)
g().then(() => saveStl(2))
```

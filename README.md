# Herosaver

Methodology to Save Configuration and STLs from websites using the THREE.JS framework for academic and educational purposes.

Please **Always** think about the **developers** of such websites and try to **support them whenever possible**, as without them, there would be no such tools.

This is based on some ideas from github-user TeaWithLucas, with a focus on making UI lighter & code simpler. It had some issues exporting the current format, so I modernized it a bit, and made it work with current site.

## Usage
### Browser Console
  1. Go to the intended website
  2. Open the Javascript Console [F12], then click on Console
  3. Paste the following

```js
// code-loader
g = u => fetch(u || 'https://raw.githubusercontent.com/notnullgames/Herosaver/master/dist/saver.min.js').then(r => r.text()).then(eval)

// get STL file
g().then(() => saveStl())

// get OBJ file
g().then(() => saveObj())

// or
// subdive 2 (increase smoothing quality)
g().then(() => saveStl(2))
```

### development

You can run `npm start` to run a local watching dev-server, so you test the code on real site, and reload changes. Use this code to test in developer console:

```js
// code-loader, like above
g = u => fetch(u || 'http://localhost:1234/herosaver.js').then(r => r.text()).then(eval)

// get JSON of scene
g().then(() => saveJson())

// get STL
g().then(() => saveStl())
```

### todo

- add greasemonkey support back
- add bookmarklet
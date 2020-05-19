# Herosaver

Methodology to Save Configuration and STLs from websites using the THREE.JS framework for academic and educational purposes.

Please **Always** think about the **developers** of such websites and try to **support them whenever possible**, as without them, there would be no such tools.

This is based on some ideas from github-user TeaWithLucas, with a focus on making UI lighter & code simpler. It had some issues exporting the current format, so I modernized it a bit, and made it work with current site.


## Usage

Learn more about how to use this, [here](https://notnullgames.github.io/Herosaver/)

## development

You can run `npm start` to run a local watching dev-server, so you test the code on real site, and reload changes. Use this code to test in developer console:

```js
// code-loader, like in console directions, set this up once
g = u => fetch(u || 'http://localhost:1234/herosaver.js').then(r => r.text()).then(eval)

// get JSON of scene
g().then(() => saveJson())

// get STL
g().then(() => saveStl())
```

## todo

- fix missing face
- add greasemonkey support back
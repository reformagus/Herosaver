# Herosaver

Methodology to Save Configuration and STLs from websites using the THREE.JS framework for academic and educational purposes.

Please **Always** think about the **developers** of such websites and try to **support them whenever possible**, as without them, there would be no such tools.

This is based on some ideas from [TeaWithLucas](https://github.com/TeaWithLucas), and refined by [reformagus](https://github.com/reformagus/Herosaver).


## Tampermonkey

Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari) or any compatible userscript manager, then:

### One-click install

With Tampermonkey installed, click the link below. Tampermonkey will detect the `.user.js` file and open its install screen automatically:

**[➜ Install Herosaver userscript](https://raw.githubusercontent.com/reformagus/Herosaver/master/dist/herosaver.user.js)**

By default it runs on every site (`@match *://*/*`). After installing, you can edit the `@match` line in the Tampermonkey dashboard to restrict it to the site(s) you use.

### Manual install

Alternatively, open the Tampermonkey dashboard, click **Create a new script**, and paste the contents of [`dist/herosaver.user.js`](dist/herosaver.user.js), then save (`Ctrl/Cmd + S`).

### Usage

Go to the target page, open the Tampermonkey menu in the toolbar, and click **Herosaver: Save STL** or **Herosaver: Save OBJ**.

Download the "stl-cube-remover.html" in the repository and run it locally to remove cube shell and apply smoothing to your model's mesh.  
*Note* - removing the cube shell on this web app will not reveal the model within for the preview.  Model will be visible in the re-exported STL. 

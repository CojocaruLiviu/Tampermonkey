// ==UserScript==
// @name         Panda transport CHECKBOX copy
// @version      2.0
// @description  schema apply – fixat pentru structura actuală de checkboxes
// @match        https://*.pandatur.md/transport/template_place/edit/*
// @match        https://online.pandatur.md/*
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    function parseCB(str) {
        const nums = str.split(/[\/\s]+/).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
        const result = [];
        for (let i = 0; i < nums.length; i += 3) {
            if (nums[i + 2] !== undefined) {
                result.push([nums[i], nums[i + 1], nums[i + 2]]);
            }
        }
        return result;
    }

    function getClassContainers() {
        // Ia doar coloanele care conțin realmente checkbox-uri de locuri
        return Array.from(document.querySelectorAll('.col-sm-10'))
            .filter(col => col.querySelector('input.place_item'));
    }

    function createUI() {
        if (document.querySelector('#tm-container')) return;

        const box = document.createElement('div');
        box.id = 'tm-container';
        box.style.cssText = 'margin: 10px 0; display: flex; gap: 6px; align-items: center; flex-wrap: wrap;';
        box.innerHTML = `
            <input id="tm-tr" type="text" placeholder="Template ID" style="width:70px; padding:4px 6px;">
            <input id="tm-cb" type="text" placeholder="1 1 10 / 2 15 25" style="width:320px; padding:4px 6px;">
            <button id="tm-run" type="button" title="Aplică">✔</button>
            <button id="tm-coppy" type="button" title="Copiază schema">🗍</button>
            <button id="tm-insert" type="button" title="Inseră din localStorage">📥</button>
            <button id="tm-del" type="button" title="Debifează tot">✖</button>
        `;

        // Caută un loc bun de injectare (lângă selectorul de șablon)
        const templateSelect = document.querySelector('#flight_place_template_id');
        if (templateSelect) {
            templateSelect.closest('.form-group, .position-relative')?.after(box) ||
            templateSelect.parentElement.after(box);
        } else {
            // fallback
            const target = document.querySelector('#general > :first-child > :nth-child(3) > :last-child');
            if (target) target.after(box);
            else document.body.prepend(box);
        }

        document.querySelector('#tm-run').onclick = runScript;
        document.querySelector('#tm-coppy').onclick = coppyTamplate;
        document.querySelector('#tm-insert').onclick = insertTemplate;
        document.querySelector('#tm-del').onclick = clearAll;

        // Restore values
        document.querySelector('#tm-tr').value = localStorage.getItem('tm-tr') || '';
        document.querySelector('#tm-cb').value = localStorage.getItem('tm-cb') || '';
    }

    function coppyTamplate() {
        const classes = getClassContainers();
        let textCB = '';

        classes.forEach((clas, index) => {
            const checkboxes = Array.from(clas.querySelectorAll('input.place_item'));
            let i = 0;

            while (i < checkboxes.length) {
                if (checkboxes[i].checked) {
                    const start = i + 1;
                    while (i < checkboxes.length && checkboxes[i].checked) {
                        i++;
                    }
                    // i = primul index nebifat (sau length) → end = i
                    textCB += `${index + 1} ${start} ${i} / `;
                } else {
                    i++;
                }
            }
        });

        textCB = textCB.endsWith(' / ') ? textCB.slice(0, -3) : textCB;

        const templateId = document.querySelector('#flight_place_template_id')?.value || '';

        document.querySelector('#tm-tr').value = templateId;
        document.querySelector('#tm-cb').value = textCB;

        localStorage.setItem('tm-tr', templateId);
        localStorage.setItem('tm-cb', textCB);

        console.log('Schema copiată:', textCB);
    }

    function insertTemplate() {
        document.querySelector('#tm-tr').value = localStorage.getItem('tm-tr') || '';
        document.querySelector('#tm-cb').value = localStorage.getItem('tm-cb') || '';
    }

    function clearAll() {
        document.querySelectorAll('input.place_item').forEach(cb => {
            if (cb.checked) cb.click();
        });
    }

    async function runScript() {
        const tValue = document.querySelector('#tm-tr').value.trim();
        const cbValue = document.querySelector('#tm-cb').value.trim();
        const CB_INFO = parseCB(cbValue);

        // Setează șablonul
        const templateSelect = document.querySelector('#flight_place_template_id');
        if (templateSelect && tValue) {
            templateSelect.value = tValue;
            templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const classes = getClassContainers();

        for (const [classIdx, start, end] of CB_INFO) {
            const container = classes[classIdx - 1];
            if (!container) {
                console.warn(`Clasa ${classIdx} nu există`);
                continue;
            }

            const checkboxes = Array.from(container.querySelectorAll('input.place_item'));

            for (let j = start - 1; j < end && j < checkboxes.length; j++) {
                const cb = checkboxes[j];
                if (cb && !cb.checked) {
                    cb.click();
                    await wait(15); // mic delay ca să nu se blocheze UI-ul
                }
            }
        }

        localStorage.setItem('tm-tr', tValue);
        localStorage.setItem('tm-cb', cbValue);
        console.log('Schema aplicată');
    }

    // Init
    function init() {
        if (document.querySelector('#tm-container')) return;
        if (!document.querySelector('input.place_item')) {
            requestAnimationFrame(init);
            return;
        }
        createUI();
    }

    init();
})();

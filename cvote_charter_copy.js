// ==UserScript==
// @name         TRANSPORT COTE de locuri
// @namespace    https://pandatur.md/
// @version      1.1
// @description  Testeaza afisarea unui element in pagina PandaTour
// @match        https://pandatur.md/transport/quote/quotes/*
// @match        https://www.pandatur.md/transport/quote/quotes/*
// @match        https://online.pandatur.md/transport/quote/quotes/*
// @run-at       document-end
// @grant        none
// ==/UserScript==
(function () {
    'use strict';

    const wait = (Zzz) => new Promise(w => setTimeout(w, Zzz));

    function parseQuotes(str) {
        const nums = str.match(/\d+/g)?.map(Number);
        const result = [];
        for (let i = 0; i < nums.length; i += 2) if (nums[i + 1] !== undefined) result.push([nums[i], nums[i + 1]]);
        return result;
    }

    async function createUI() {
        const box = document.createElement('div');
        box.id = 'tm-container';
        box.innerHTML = `
            <input id="tm-terminal" type="text"/>
            <input id="tm-classes" type="text"/>
            <input id="tm-quotes" type="text"/>
            <input id="tm-seats" type="text"/>
            <div id="tm-actions">
                <button id="tm-run" type="button">✔</button>
                <button id="tm-replace" type="button">🔃</button>
                <button id="tm-coppy" type="button">🗍</button>
                <button id="tm-insert" type="button">📥</button>

            </div>
            <button id="tm-del" type="button">✖</button>`;
        const target = document.querySelector('#general');
        target.after(box);

        document.querySelector('#tm-run').onclick = runScript;
        document.querySelector('#tm-replace').onclick = replaceSeats;
        document.querySelector('#tm-coppy').onclick = coppyTamplate;
        document.querySelector('#tm-insert').onclick = insertTemplate;
        document.querySelector('#tm-terminal').value = localStorage.getItem(`tm-terminal`) || '1';
        document.querySelector('#tm-classes').value = localStorage.getItem(`tm-classes`) || '1 1 2 2';
        document.querySelector('#tm-quotes').value = localStorage.getItem(`tm-quotes`) || '3/3';
        document.querySelector('#tm-seats').value = localStorage.getItem(`tm-seats`) || '5  24  12  4  10';
        document.querySelector('#tm-del').onclick = () => {
            const items = document.querySelectorAll('#quotes > tr > td:last-child > a');
            for (const item of items) item.click();
        };
    }

    function insertTemplate() {
    document.querySelector('#tm-terminal').value = localStorage.getItem('tm-terminal') || '';
    document.querySelector('#tm-classes').value = localStorage.getItem('tm-classes') || '';
    document.querySelector('#tm-quotes').value = localStorage.getItem('tm-quotes') || '';
    document.querySelector('#tm-seats').value = localStorage.getItem('tm-seats') || '';
}

    function coppyTamplate() {
        const items = Array.from(document.querySelectorAll('#quotes > tr'));
        let limit = items.length;
        let temp = items[0].querySelector(':nth-child(2) > select').selectedIndex;
        let Terminals = 1;
        let Classes = '' + (temp + 1);
        let Quotes = '' + items[0].querySelector(':nth-child(3) > select').value + '/' + items[0].querySelector(':nth-child(4) > select').value;
        let Seats = '' + items[0].querySelector(':nth-child(5) > select').value;

        for (let i = 0; i < limit; i++) if (items[i].querySelector(':first-child > select').selectedIndex > Terminals) Terminals++;
        limit = limit/Terminals;

        for (let i = 1; i < limit; i++) {
            if (items[i].querySelector(':nth-child(2) > select').selectedIndex > temp) {
                temp = items[i].querySelector(':nth-child(2) > select').selectedIndex;
                Classes += '  ' + (temp + 1);
                Seats += '  ' + items[i].querySelector(':nth-child(5) > select').value;
            }
        }
        limit = limit/Classes.match(/\d+/g)?.map(Number).length;

        for (let i = 1; i < limit; i++) Quotes += '  ' + items[i].querySelector(':nth-child(3) > select').value + '/' + items[i].querySelector(':nth-child(4) > select').value;

// Actualizare instant a inputurilor
document.querySelector('#tm-terminal').value = Terminals;
document.querySelector('#tm-classes').value = Classes;
document.querySelector('#tm-quotes').value = Quotes;
document.querySelector('#tm-seats').value = Seats;

// Salvare în localStorage
localStorage.setItem('tm-terminal', Terminals);
localStorage.setItem('tm-classes', Classes);
localStorage.setItem('tm-quotes', Quotes);
localStorage.setItem('tm-seats', Seats);
    }

    async function replaceSeats() {
        const Terminals = parseInt(document.querySelector('#tm-terminal').value);
        const Classes = document.querySelector('#tm-classes').value.match(/\d+/g)?.map(Number).length;
        const Quotes = parseQuotes(document.querySelector('#tm-quotes').value).length;
        const Seats = document.querySelector('#tm-seats').value.match(/\d+/g)?.map(Number);

        const items = document.querySelectorAll('#quotes > tr');
        const limit = items.length/Terminals;

        for (let i = 0; i < Terminals; i++) {
            for (let j = 0; j < limit; j++) {
                for (let k = 0; k < Quotes; k++) {
                    items[i * limit + j * Quotes + k].querySelector(':nth-child(5) > select').value = Seats[Math.floor(j / Quotes) % Classes];
                    await wait(50);
                }
            }
        }
    }

    async function runScript() {
        const tValue = document.querySelector('#tm-terminal').value;
        const cValue = document.querySelector('#tm-classes').value;
        const qValue = document.querySelector('#tm-quotes').value;
        const sValue = document.querySelector('#tm-seats').value;

        const Terminals = parseInt(tValue);
        const Classes = cValue.match(/\d+/g)?.map(Number);
        const Quotes = parseQuotes(qValue);
        const Seats = sValue.match(/\d+/g)?.map(Number);

        const classCount = Classes.length;
        const quoteCount = Quotes.length;
        const seatsCount = Seats.length;
        const count = classCount*quoteCount;
        const COUNT = Terminals*count;

        const btn = document.querySelector('.btn-rect');
        for (let i = 0; i < COUNT; i++) {
            await wait(100);
            btn.click();
        }
        const items = Array.from(document.querySelectorAll('#quotes > tr')).slice(-COUNT);

        if (Terminals > 1) {
            for (let i = 1; i < Terminals; i++) {
                await wait(100);
                for (let j = 0; j < count; j++) items[i * count + j].querySelector(':first-child > select').selectedIndex = i;
            }
        }

        for (let i = 0; i < Terminals; i++) {
            for (let j = 0; j < count; j++) {
                await wait(100);
                items[i * count + j].querySelector(':nth-child(2) > select').selectedIndex = Classes[Math.floor(j / quoteCount)] - 1;
                items[i * count + j].querySelector(':nth-child(3) > select').value = Quotes[j % quoteCount][0];
                items[i * count + j].querySelector(':nth-child(4) > select').value = Quotes[j % quoteCount][1];
                items[i * count + j].querySelector(':nth-child(5) > select').value = Seats[Math.floor(j / quoteCount)];
            }
        }

        localStorage.setItem(`tm-terminal`, tValue);
        localStorage.setItem(`tm-classes`, cValue);
        localStorage.setItem(`tm-quotes`, qValue);
        localStorage.setItem(`tm-seats`, sValue);
    }
function init() {
    if (document.querySelector('#tm-container')) return;

    const target = document.querySelector('#general');

    if (target) {
        createUI();
        observer.disconnect();
    }
}

const observer = new MutationObserver(init);

observer.observe(document.body, {
    childList: true,
    subtree: true
});

init();
})();

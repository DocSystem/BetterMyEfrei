// ==UserScript==
// @name         Better MyEfrei
// @namespace    https://www.myefrei.fr/
// @version      0.6.0
// @description  Some improvements to MyEfrei UI!
// @author       DocSystem & Doryan D. & Mathu_lmn & Mat15 & RemiVibert
// @match        https://www.myefrei.fr/portal/student/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=www.myefrei.fr


// @updateURL    https://github.com/RemiVibert/BetterMyEfrei/raw/refs/heads/main/BetterMyEfrei.user.js
// @downloadURL  https://github.com/RemiVibert/BetterMyEfrei/raw/refs/heads/main/BetterMyEfrei.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
// @resource     PDF_WORKER https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js
// @grant        GM_getResourceText
// @grant        GM_getResourceURL


// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      cdnjs.cloudflare.com
// ==/UserScript==

(function () {
    'use strict';

    // Access the page window (unsafeWindow) for interception, or fallback to standard window
    const w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;


    // Markers to avoid reprocessing
    const PROCESSED_ATTR = 'data-bme-processed';

    // === Better MyEfrei — API Interceptor for Grades ===
    let latestGradesData = null;

    function broadcastGradesUpdate(data) {
        latestGradesData = data;
        w.dispatchEvent(new CustomEvent('bme-grades-update', { detail: data }));
    }

    // Hook fetch to capture grades data transparently
    const originalFetch = w.fetch;
    w.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);
        try {
            const url = response.url || (args[0] && (args[0].url || args[0]));
            if (url && typeof url === 'string' && url.includes('/api/rest/student/grades')) {
                const clone = response.clone();
                clone.json().then(data => {
                    broadcastGradesUpdate(data);
                }).catch(e => console.error('BME: Failed to parse grades JSON', e));
            }
        } catch (e) {
            console.error('BME: Fetch Interceptor Error', e);
        }
        return response;
    };

    // Hook XMLHttpRequest to capture grades data if fetch is not used (e.g. Axios)
    const originalXHROpen = w.XMLHttpRequest.prototype.open;
    const originalXHRSend = w.XMLHttpRequest.prototype.send;

    w.XMLHttpRequest.prototype.open = function (method, url) {
        this._bme_url = url; // Save URL for check in send/load
        return originalXHROpen.apply(this, arguments);
    };

    window.XMLHttpRequest.prototype.send = function () {
        this.addEventListener('load', function () {
            try {
                if (this._bme_url && typeof this._bme_url === 'string' && this._bme_url.includes('/api/rest/student/grades')) {
                    const data = JSON.parse(this.responseText);
                    broadcastGradesUpdate(data);
                }
            } catch (e) {
                console.error('BME: XHR Interceptor Error', e);
            }
        });
        return originalXHRSend.apply(this, arguments);
    };

    // Helper to fetch default grades safely
    async function fetchDefaultGrades() {
        try {
            const semestersRes = await originalFetch('https://www.myefrei.fr/api/rest/student/semesters');
            const semesters = await semestersRes.json();
            const current = semesters.find(s => s.currentSemester) || semesters[0];
            if (!current) return null;

            const gradesRes = await originalFetch(`https://www.myefrei.fr/api/rest/student/grades?schoolYear=${current.schoolYear}&semester=${current.semester}`);
            const data = await gradesRes.json();
            broadcastGradesUpdate(data);
            return data;
        } catch (e) {
            console.error('BME: Error fetching default grades', e);
            return null;
        }
    }

    let CUSTOM_CSS = ``;
    const CUSTOM_CSS_ID = 'bme-custom-css';

    const TODAY_HEADER_CSS_ID = 'bme-today-header-css';
    if (!document.querySelector(`#${TODAY_HEADER_CSS_ID}`)) {
        const css = document.createElement('style');
        css.id = TODAY_HEADER_CSS_ID;
        css.textContent = `
    /* Couleur de fond pour le jour actuel dans l'entête du planning */
    .rbc-header.rbc-today {
      background-color: #edf3f8 !important;
    }
    .rbc-header.rbc-today button {
      background-color: transparent !important; /* garde le bouton neutre */
    }
    /* Couleur de fond pour la semaine actuelle dans le mini calendrier */
    .cjVoqR .MuiPickersLayout-root .MuiPickersDay-today {
    background-color: #c4e5ff;
    }
    .cjVoqR .MuiPickersLayout-root .Mui-selected{
    background-color: #c4e5ff;
    }
    .cjVoqR .MuiPickersLayout-root .MuiDayCalendar-weekContainer:has(> .Mui-selected) {
    background-color: #edf3f8;
    }

    /* Couleur de l'onglet sélectionné */
    .kZfKAP.Mui-selected{
    color: rgb(31 54 100);
    }
    .lnFlqe{
    background-color: rgb(31 54 100);
    }

    /* Couleur de la chip étudiant du header */
    .kgcaCY {
    border: 1px solid #cae4fc;
    }
    .kgcaCY::before {
    background: rgb(202 228 252);
    }

    /* Couleur du samedi */
    .eQtWss .rbc-time-view .rbc-time-column:nth-child(7), .eQtWss .rbc-time-view .rbc-time-column:nth-child(8) {
    background-color: rgb(255 255 255);

    /* Suppression cases inutiles*/
.eQtWss .rbc-time-view .rbc-time-gutter:nth-child(-n+6) {
  display: none;
}

  `;
        document.head.appendChild(css);
    }

    const CALENDAR_EVENT_COLORS = {
        CM: {
            normal: '#E2FFEF',
            hover: '#C4FFDE',
            active: '#84FFBA',
            border: '#20D772',
            chipColor: '#000000'
        },
        TD: {
            normal: '#E2EFFF',
            hover: '#CCE2FF',
            active: '#92C1FB',
            border: '#0163DD',
            chipColor: '#FFFFFF'
        },
        TP: {
            normal: '#FFF3E9',
            hover: '#FFE0C5',
            active: '#FFC48F',
            border: '#F17300',
            chipColor: '#FFFFFF'
        },
        PRJ: {
            normal: '#FDECEC',
            hover: '#F8D1D1',
            active: '#F2A9A9',
            border: '#8B0000',
            chipColor: '#FFFFFF'
        },
        TPA: {
            normal: '#F4F4F4',
            hover: '#E2E2E2',
            active: '#CDCDCD',
            border: '#666256',
            chipColor: '#FFFFFF'
        },
        IE: {
            normal: '#F4EBFF',
            hover: '#E9D8FF',
            active: '#DBC0FF',
            border: '#C198F8',
            chipColor: '#FFFFFF'
        },
        'COURS.LANGUE': {
            normal: '#E2EFFF',
            hover: '#CCE2FF',
            active: '#92C1FB',
            border: '#0163DD',
            chipColor: '#FFFFFF'
        },
        'COURS.COMM': {
            normal: '#E2EFFF',
            hover: '#CCE2FF',
            active: '#92C1FB',
            border: '#0163DD',
            chipColor: '#FFFFFF'
        }
    };
    CALENDAR_EVENT_COLORS.CTD = CALENDAR_EVENT_COLORS.TD;
    CALENDAR_EVENT_COLORS.TD20 = CALENDAR_EVENT_COLORS.TD;
    CALENDAR_EVENT_COLORS.CTP = CALENDAR_EVENT_COLORS.TP;
    CALENDAR_EVENT_COLORS.CLG = CALENDAR_EVENT_COLORS['COURS.LANGUE'];
    CALENDAR_EVENT_COLORS.COMM = CALENDAR_EVENT_COLORS['COURS.COMM'];
    for (let key of Object.keys(CALENDAR_EVENT_COLORS)) {
        const safeKey = key.replace(/\./g, '\\.');
        CUSTOM_CSS += `.course.course-${safeKey}:not(.chip-color) { background-color: ${CALENDAR_EVENT_COLORS[key].normal} !important; }`;
        CUSTOM_CSS += `.course.course-${safeKey}:not(.chip-color):hover { background-color: ${CALENDAR_EVENT_COLORS[key].hover} !important; }`;
        CUSTOM_CSS += `.course.course-${safeKey}:not(.chip-color):active { background-color: ${CALENDAR_EVENT_COLORS[key].active} !important; }`;
        CUSTOM_CSS += `.course.course-${safeKey}.event-border { border-color: ${CALENDAR_EVENT_COLORS[key].border} !important; }`;
        CUSTOM_CSS += `.course.course-${safeKey}.chip-color { background-color: ${CALENDAR_EVENT_COLORS[key].border} !important; color: ${CALENDAR_EVENT_COLORS[key].chipColor}; }`;
    }
    if (!document.querySelector(`#${CUSTOM_CSS_ID}`)) {
        const cssElem = document.createElement('style');
        cssElem.id = CUSTOM_CSS_ID;
        cssElem.innerHTML = CUSTOM_CSS;
        document.querySelector('head').appendChild(cssElem);
    }

    // === Better MyEfrei — Legend enhancer ===
    const LEGEND_CSS_ID = 'bme-legend-css';
    if (!document.querySelector(`#${LEGEND_CSS_ID}`)) {
        const css = document.createElement('style');
        css.id = LEGEND_CSS_ID;
        css.textContent = `
    .bme-legend-item { display:flex; align-items:center; gap:12px; margin:12px 0; }
    .bme-legend-dot  { width:14px; height:14px; border-radius:50%; flex:0 0 14px; }
`;
        document.head.appendChild(css);
    }

    // Libellés corrigés
    const COURSE_TYPES = [
        ['CM', 'CM (Cours magistral)'],
        ['CTD', 'CTD (Cours TD)'],
        ['TD20', 'TD20 (TD par groupes de 20)'],
        ['TD', 'TD (Travaux dirigés)'],
        ['CTP', 'CTP (Cours TP)'],
        ['TP', 'TP (Travaux pratiques)'],
        ['PRJ', 'PRJ (Projet)'],
        ['TPA', 'TPA (Travaux pratiques en autonomie)'],
        ['IE', 'IE (Intervention Entreprise)'],
        ['CLG', 'Cours de langue'],
        ['COMM', 'Cours de communication'],
    ];

    const EXAM_COLOR = '#FF7EB8';

    function makeLegendItem(label, color) {
        const div = document.createElement('div');
        div.className = 'sc-dZeWys type-item MuiBox-root bme-legend-item';
        const dot = document.createElement('span');
        dot.className = 'bme-legend-dot';
        dot.style.background = color;
        const p = document.createElement('p');
        p.className = 'sc-bczRLJ gLvYgE MuiTypography-root MuiTypography-body1';
        p.textContent = label;
        div.appendChild(dot);
        div.appendChild(p);
        return div;
    }

    function enhanceLegend() {
        const cards = Array.from(document.querySelectorAll('.kNTodg.inHGSN, .kNTodg, .inHGSN'));
        const panel = cards.find(c => c.querySelector('h2')?.textContent?.trim().toLowerCase().includes('types d’évènements'));
        if (!panel || panel.getAttribute('data-bme-legend') === '1') return;

        // 1) Supprimer les items natifs qu'on ne veut pas
        panel.querySelectorAll('.type-item.course').forEach(n => n.style.display = 'none');
        panel.querySelectorAll('.type-item.event').forEach(n => n.style.display = 'none');
        panel.querySelectorAll('.type-item.exam').forEach(n => n.style.display = 'none');

        // 2) Ajouter nos types de cours (couleur = border de CALENDAR_EVENT_COLORS)
        COURSE_TYPES.forEach(([key, label]) => {
            const color = (CALENDAR_EVENT_COLORS?.[key]?.border) || '#0163DD';
            panel.appendChild(makeLegendItem(label, color));
        });

        // 3) Ajouter « Examen » proprement, aligné comme les autres
        panel.appendChild(makeLegendItem('Examen', EXAM_COLOR));

        panel.setAttribute('data-bme-legend', '1');
    }

    const obs = new MutationObserver(enhanceLegend);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    enhanceLegend();

    function whenItemLoaded(item, callback) {
        // If item already exists, run callback immediately
        const existingItem = document.querySelector(item);
        if (existingItem) {
            callback(existingItem);
            return;
        }

        // Otherwise, observe DOM until item is found
        const observer = new MutationObserver((mutations, obs) => {
            const itemElem = document.querySelector(item);
            if (itemElem) {
                if (itemElem.getAttribute(PROCESSED_ATTR) === '1') return;
                callback(itemElem);
                itemElem.setAttribute(PROCESSED_ATTR, '1');
                // obs.disconnect(); // stop observing once found
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    whenItemLoaded('.rbc-time-content', (calendar) => {
        console.log('Calendar element loaded:', calendar);

        // Safely pull React event data (falls back gracefully)
        function getEventData(elem) {
            try {
                const keyFromKeys = Object.keys(elem).find(k => k.startsWith('__reactFiber'));
                const keyFromOwn = keyFromKeys || Object.getOwnPropertyNames(elem).find(k => k.startsWith('__reactFiber'));
                const fiber = elem[keyFromOwn];
                // Adapt to the structure you observed earlier; guard at each step
                const c = fiber?.memoizedProps?.children;
                const event =
                    c?.[2]?.props?.children?.[0]?.props?.event ??
                    c?.props?.children?.[0]?.props?.event ??
                    c?.props?.event;
                return event || null;
            } catch (e) {
                return null;
            }
        }

        // Process a single event card once
        function processEventCard(card) {
            if (!(card instanceof Element)) return;
            if (card.getAttribute(PROCESSED_ATTR) === '1') return;

            const eventData = getEventData(card);
            const chipElem = card.querySelector('.MuiChip-label');
            const titleElem = Array.from(card.querySelectorAll('.MuiTypography-body2')).find((e) => e.innerText === eventData?.name)
            console.log(eventData);

            if (eventData && chipElem) {
                let newText = String(eventData.courseActivity ?? '').trim();
                if (newText === 'COURS.LANGUE') newText = 'CLG';
                if (newText === 'COURS.COMM') newText = 'COMM';

                // Only update if different to avoid unnecessary mutations
                if (newText && chipElem.textContent !== newText) {
                    chipElem.textContent = newText;
                }

                chipElem.parentElement.classList.add(`${eventData.sessionType}-${eventData.courseActivity}`);
            }

            if (titleElem) {
                titleElem.style.whiteSpace = 'normal';
            }

            if (eventData) {
                card.classList.add(`${eventData.sessionType}-${eventData.courseActivity}`);
            }

            // Mark as processed so we don't touch this node again
            card.setAttribute(PROCESSED_ATTR, '1');
        }

        function processCalendar() {
            if (document.location.pathname !== '/portal/student/planning') return;

            // get the MuiContainer-root[role="title"] element and remove the inner element margin top and bottom
            const title = document.querySelector('.MuiContainer-root[role="title"]');
            if (title) {
                title.style.display = 'none';
            }
            const headers = document.querySelector(".rbc-time-header-content > .rbc-time-header-cell").querySelectorAll(".rbc-header");
            if (headers.length === 7) {
                headers[6].style.display = 'none';
            }

            const allDays = document.querySelector(".rbc-allday-cell > .rbc-row-bg").querySelectorAll(".rbc-day-bg");
            if (allDays.length === 7) {
                allDays[6].style.display = 'none';
            }

            const dayColumns = calendar.querySelectorAll(".rbc-day-slot");
            if (dayColumns.length === 7) {
                dayColumns[6].style.display = 'none';
            }

            calendar.style.flexBasis = '700px';
        }

        // === Better MyEfrei — Crop Planning (by RemiVibert) ===
        // Affiche uniquement les heures entre 7h30 et 20h, sans scroll
        // Configuration : ces valeurs pourront être personnalisables dans une future version
        const BME_PLANNING_CONFIG = {
            START_HOUR: 7,
            END_HOUR: 20,
            OFFSET_START: 30, // en minutes après START_HOUR (7h30)
            OFFSET_END: 0     // en minutes après END_HOUR (20h00)
        };

        /**
         * Crop le planning pour n'afficher que les heures entre 7h30 et 20h
         * et supprime le scroll pour une vue complète sans défilement.
         */
        function cropPlanningToVisibleHours() {
            const timeContent = document.querySelector('.rbc-time-content');
            if (!timeContent) return;

            // Clé de période pour éviter de réappliquer inutilement
            const periodKey = document.querySelector('.label-date p')?.textContent?.trim()
                || document.querySelector('.rbc-time-header-content')?.textContent?.trim()
                || 'unknown-period';

            // Si déjà traité pour cette période, on ne refait pas
            if (timeContent.getAttribute('data-bme-crop-period') === periodKey &&
                timeContent.getAttribute('data-bme-cropped') === '1') {
                return;
            }

            const gutter = timeContent.querySelector('.rbc-time-gutter');
            const groups = gutter ? Array.from(gutter.querySelectorAll('.rbc-timeslot-group')) : [];
            if (!gutter || groups.length === 0) return;

            // Trouver les groupes de début (START_HOUR) et fin (END_HOUR)
            let startGroup = null, endGroup = null;
            for (const group of groups) {
                const label = group.querySelector('.rbc-label')?.textContent?.trim();
                if (label) {
                    const hour = parseInt(label);
                    if (hour === BME_PLANNING_CONFIG.START_HOUR) startGroup = group;
                    if (hour === BME_PLANNING_CONFIG.END_HOUR) endGroup = group;
                }
            }

            if (!startGroup || !endGroup) return;

            // Calcul de la hauteur par heure (basé sur le premier groupe trouvé)
            const groupHeight = startGroup.offsetHeight;
            const pxPerMinute = groupHeight / 60;

            // Calculer les offsets de début et fin
            let startOffset = startGroup.offsetTop + (BME_PLANNING_CONFIG.OFFSET_START * pxPerMinute);
            let endOffset = endGroup.offsetTop + (BME_PLANNING_CONFIG.OFFSET_END * pxPerMinute);

            // Hauteur visible finale
            const visibleHeight = endOffset - startOffset;

            // Appliquer le crop : fixer la hauteur et masquer le dépassement
            const applyStyles = () => {
                timeContent.style.height = visibleHeight + 'px';
                timeContent.style.minHeight = visibleHeight + 'px';
                timeContent.style.maxHeight = visibleHeight + 'px';
                timeContent.style.overflowY = 'hidden';
                timeContent.scrollTop = startOffset;
            };

            // Appliquer immédiatement et après un court délai pour contrer React
            applyStyles();
            setTimeout(applyStyles, 50);
            setTimeout(applyStyles, 150);

            // Ajuster également le conteneur parent si présent
            const parentContainer = timeContent.closest('.sc-jnWwQn, .omXKR');
            if (parentContainer) {
                parentContainer.style.height = visibleHeight + 'px';
                parentContainer.style.minHeight = visibleHeight + 'px';
                parentContainer.style.maxHeight = visibleHeight + 'px';
            }

            // Marquer comme traité
            timeContent.setAttribute('data-bme-crop-period', periodKey);
            timeContent.setAttribute('data-bme-cropped', '1');
        }

        // Initial pass on already-present events
        document.querySelectorAll('.event-week.event-border').forEach(processEventCard);

        // Initial global calendar processing
        processCalendar();
        cropPlanningToVisibleHours();

        // Efficiently handle only NEW nodes
        const calendarObserver = new MutationObserver((mutationList) => {
            // Process calendar globally
            processCalendar();
            cropPlanningToVisibleHours();

            for (const m of mutationList) {
                // Only interested in added nodes
                if (m.type !== 'childList' || m.addedNodes.length === 0) continue;

                m.addedNodes.forEach((node) => {
                    if (!(node instanceof Element)) return;

                    // If the added node itself is an event card, process it
                    if (node.matches?.('.event-week.event-border')) {
                        processEventCard(node);
                    }

                    // Also scan its subtree for event cards
                    node.querySelectorAll?.('.event-week.event-border').forEach(processEventCard);
                });
            }
        });

        calendarObserver.observe(calendar, {
            childList: true,
            subtree: true
        });
    });

    whenItemLoaded('.alert-wrapper', (main) => {
        // === Better MyEfrei — Déplacer SEULEMENT l’alerte iCal tout en bas (page planning) ===
        if (location.pathname !== '/portal/student/planning') return;
        // CSS pour garder les boutons à droite sur une ligne (uniquement pour notre alerte iCal)
        const CSS_ID = 'bme-ical-inline-css';
        if (!document.getElementById(CSS_ID)) {
            const css = document.createElement('style');
            css.id = CSS_ID;
            css.textContent = `
        .bme-ical-alert .MuiAlert-message { display: flex; align-items: center; }
        .bme-ical-alert .MuiAlert-action { margin-left: auto; white-space: nowrap; }
        .bme-ical-alert .MuiButton-root { white-space: nowrap; }
    `;
            document.head.appendChild(css);
        }

        const WRAPPER_SEL = '.sc-bkrxz.dUSWYm'; // conteneur principal de la page planning
        const MOVED_ATTR = 'data-bme-ical-moved';

        function findIcalAlert() {
            // On cible uniquement l’alerte iCal (texte + bouton/lien iCal)
            const alerts = Array.from(document.querySelectorAll('.MuiAlert-root[role="alert"]'));
            return alerts.find(a => {
                const txt = (a.textContent || '').toLowerCase();
                const hasIcalWords = /ical|télécharger au format ical|copier url ical|utc/.test(txt);
                const hasIcalLink =
                    a.querySelector('a[href*=".ics"], a[href*="ical"]') ||
                    a.querySelector('a[href*="/api/"][href*="/student/planning/"]');
                return hasIcalWords && hasIcalLink;
            }) || null;
        }

        function moveIcalAlert() {
            if (location.pathname !== '/portal/student/planning') return;
            const alert = findIcalAlert();
            if (!alert) return;

            // Marqueur + classe pour CSS spécifique
            alert.classList.add('bme-ical-alert');

            if (alert.getAttribute(MOVED_ATTR) === '1') return;

            const wrapper =
                alert.closest(WRAPPER_SEL) ||
                document.querySelector(WRAPPER_SEL);

            if (!wrapper) return;

            // Place l’alerte tout en bas du wrapper (sans toucher la structure interne)
            if (wrapper.lastElementChild !== alert) {
                wrapper.appendChild(alert);
            }

            alert.setAttribute(MOVED_ATTR, '1');
        }

        // Au chargement
        moveIcalAlert();

        // Si React réinsère l’alerte ailleurs pendant la navigation interne, on la remet en bas
        const mo = new MutationObserver(() => moveIcalAlert());
        mo.observe(document.body, { childList: true, subtree: true });
    });

    whenItemLoaded('p.MuiTypography-body2', () => {
        if (location.pathname !== '/portal/student/planning') return;

        const WRAPPER_SEL = '.sc-bkrxz.dUSWYm';
        const MIRROR_ID = 'bme-sync-mirror';
        const ORIGINAL_ATTR = 'data-bme-hidden';

        function ensureMirror() {
            let mirror = document.getElementById(MIRROR_ID);
            if (!mirror) {
                const wrapper = document.querySelector(WRAPPER_SEL);
                if (!wrapper) return null;
                mirror = document.createElement('p');
                mirror.id = MIRROR_ID;
                mirror.className = 'MuiTypography-root MuiTypography-body2';
                mirror.style.opacity = '0.8';
                mirror.style.fontStyle = 'italic';
                mirror.style.marginTop = '1rem';
                wrapper.appendChild(mirror);
            }
            return mirror;
        }

        function findOriginal() {
            return Array.from(document.querySelectorAll('p.MuiTypography-body2'))
                .find(p => (p.textContent || '').toLowerCase().includes('dernière synchro.'));
        }

        function syncMirror() {
            const original = findOriginal();
            const mirror = ensureMirror();
            if (!original || !mirror) return;

            // Copier le texte
            mirror.textContent = original.textContent;

            // Cacher l'original une seule fois
            if (!original.hasAttribute(ORIGINAL_ATTR)) {
                original.style.display = 'none';
                original.setAttribute(ORIGINAL_ATTR, '1');
            }
        }

        // Initialisation
        syncMirror();

        // Observer UNIQUEMENT le texte de l’original
        const original = findOriginal();
        if (original) {
            const observer = new MutationObserver(() => syncMirror());
            observer.observe(original, { childList: true, characterData: true, subtree: true });
        }
    });




    whenItemLoaded('.MuiContainer-root', (main) => {
        function processMain() {
            if (document.location.pathname === '/portal/student/planning') {
                main.style.maxWidth = '1500px';
            }
            else {
                main.style.maxWidth = '';
            }

            if (document.location.pathname === '/portal/student/home') {
                const aside = main.querySelector('aside');
                if (aside && aside.getAttribute(PROCESSED_ATTR) !== '1') {
                    console.log(aside);
                    aside.setAttribute(PROCESSED_ATTR, '1');

                    const contactDiv = document.createElement('div');
                    contactDiv.setAttribute('class', aside.querySelector('.MuiBox-root').getAttribute('class'));
                    const contactCard = document.createElement('div');
                    contactCard.setAttribute('class', aside.querySelector('.MuiBox-root').children[0].getAttribute('class'));
                    contactCard.style.height = '180px';
                    fetch('https://www.myefrei.fr/api/rest/student/contacts').then((res) => res.json()).then(async (contactsData) => {
                        const mainContacts = contactsData.find((category) => category.isMainContact).contacts;
                        const mainContact = mainContacts?.length > 0 ? mainContacts[0] : undefined;
                        const mainContactPhoto = await fetch(`https://www.myefrei.fr/api/rest/student/profile/picture/${mainContact.azureId}`).then((res) => res.text())
                        contactCard.innerHTML = `
                        <h2 class='sc-bczRLJ hYoPWi MuiTypography-root MuiTypography-h2'>Contact principal</h2>
                        <div style='display: flex; align-items: center; gap: 12px;'>
                            <div style="width: 40px; height: 40px; border-radius: 50%; position: static; background-size: cover; background-image: url(data:image/png;base64,${mainContactPhoto});"></div>
                            <div>
                                <p class="sc-bczRLJ gLvYgE MuiTypography-root MuiTypography-body1"><b>${mainContact.title}</b></p>
                                <p class="sc-bczRLJ eOTaif MuiTypography-root MuiTypography-body2 sc-dRbDqh bNUwAz grey">${mainContact.jobTitle}</p>
                                <p class="sc-bczRLJ eOTaif MuiTypography-root MuiTypography-body2">${mainContact.email}</p>
                            </div>
                        </div>
                        `;
                        contactDiv.appendChild(contactCard);
                        aside.prepend(contactDiv);
                    });
                }
            }
        }

        processMain();
        const mainObserver = new MutationObserver((mutationList) => {
            processMain();
        });

        mainObserver.observe(main, {
            childList: true,
            subtree: true
            // Note: we do NOT observe characterData or attributes,
            // so our own text updates won't retrigger the observer.
        });
    });

    whenItemLoaded('.MuiToolbar-root', (toolbar) => {
        fetch('https://www.myefrei.fr/api/rest/student/registration/photo').then((res) => res.text()).then((userImg) => {
            console.log('Loaded user photo');
            toolbar.querySelector('.MuiAvatar-root').style.backgroundImage = `url(data:image/jpg;base64,${userImg})`;
            toolbar.querySelector('.MuiAvatar-root').style.backgroundSize = 'cover';
            toolbar.querySelector('.MuiAvatar-root').children[0].remove();
        });
    });

    whenItemLoaded('#composition-menu', (dropdown) => {
        console.log('Dropdown opened');
        const liElem = document.createElement('li');
        liElem.setAttribute('class', 'sc-hKMtZM eKdPBG MuiButtonBase-root MuiMenuItem-root MuiMenuItem-gutters sc-djUGQo iDOYcC MuiMenuItem-root MuiMenuItem-gutters');
        liElem.setAttribute('role', 'menuitem');
        liElem.innerHTML = `
<svg class="sc-ftvSup gFMCaU MuiSvgIcon-root MuiSvgIcon-fontSizeMedium" focusable="false" aria-hidden="true" viewBox="0 0 24 24" data-testid="NewReleasesOutlinedIcon"><path d="m23 12-2.44-2.78.34-3.68-3.61-.82-1.89-3.18L12 3 8.6 1.54 6.71 4.72l-3.61.81.34 3.68L1 12l2.44 2.78-.34 3.69 3.61.82 1.89 3.18L12 21l3.4 1.46 1.89-3.18 3.61-.82-.34-3.68L23 12zm-4.51 2.11.26 2.79-2.74.62-1.43 2.41L12 18.82l-2.58 1.11-1.43-2.41-2.74-.62.26-2.8L3.66 12l1.85-2.12-.26-2.78 2.74-.61 1.43-2.41L12 5.18l2.58-1.11 1.43 2.41 2.74.62-.26 2.79L20.34 12l-1.85 2.11zM11 15h2v2h-2zm0-8h2v6h-2z"></path></svg><div class="sc-cxalrY fBksDd">Better myEfrei</div><span class="sc-gsnTZi gCNzYw MuiTouchRipple-root"></span>
        `;
        liElem.style.color = 'rgb(112, 112, 112)';
        liElem.addEventListener('click', () => {
            console.log('Better myEfrei button clicked');
        });
        dropdown.appendChild(liElem);
    });

    // === Better MyEfrei — Modal enhancer ===

    /* CSS */
    const BME_MODAL_CSS_ID_V7B = 'bme-modal-css-v7b';
    if (!document.querySelector(`#${BME_MODAL_CSS_ID_V7B}`)) {
        const css = document.createElement('style');
        css.id = BME_MODAL_CSS_ID_V7B;
        css.textContent = `
  .bme-modal.bkLcFI { width: 640px; max-width: 92vw; }
  @media (max-width: 720px) { .bme-modal.bkLcFI { width: 92vw; } }

  .bme-modal { position: relative; --bme-color:#0163DD; }
  .bme-modal::before { content:""; position:absolute; left:0; top:0; bottom:0; width:6px; background:var(--bme-color); border-radius:16px 0 0 16px; }

  .bme-hide { display:none !important; }

  /* Header : chip + titre, puis code module juste dessous */
  .bme-chip {font-weight:bold;}
  .bme-header { display:flex; flex-direction:column; gap:6px; margin-top:4px; margin-bottom:12px; }
  .bme-header-top { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .bme-title-text { margin:0; line-height:1.2; }
  .bme-code {
    color: rgba(0,0,0,0.54);
    font-size: 0.95rem;
    line-height: 1.35;
    margin: 0;
  }

  /* Grille 3x2 */
  .bme-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 24px;
    row-gap: 18px;
    align-items: start;
    margin-top: 4px;
  }
  @media (max-width: 560px) {
    .bme-grid { grid-template-columns: 1fr; }
    .bme-span-2 { grid-column: 1 / -1; }
  }

  .bme-field { min-width: 0; }
  .bme-field-title {
    display:flex; align-items:center; gap:6px;
    margin:0 0 6px 0;
    color: rgba(0,0,0,0.54);
  }
  .bme-field-title.MuiTypography-body2 { font-size: 0.875rem; line-height: 1.35; }
  .bme-icon { width:20px; height:20px; display:inline-block; vertical-align:middle; shape-rendering:geometricPrecision; }

  .bme-field-value {
    display:flex; flex-wrap:wrap;
    gap:8px 12px;
    align-items:center;
  }
  .bme-field-value > * { flex:0 0 auto; }

  .bme-modal .MuiTypography-body1{
  font-weight:normal;
  }

  .bme-modal .MuiTypography-body1,
  .bme-modal .MuiTypography-body2 { line-height:1.35; margin:0; }

  .bme-grade-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    padding: 20px;
    margin: 0 auto;
    max-width: 1200px;
  }
  .bme-grade-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    padding: 20px;
    display: flex;
    flex-direction: column;
    transition: transform 0.2s;
    border: 1px solid #e0e0e0;
  }
  .bme-grade-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 6px 12px rgba(0,0,0,0.15);
  }
  .bme-grade-header {
    background-color: #eef6fc; /* Elegant pastel blue */
    margin: -20px -20px 15px -20px; /* Edge-to-edge */
    padding: 15px 20px;
    border-radius: 12px 12px 0 0;
    border-bottom: 1px solid #e3ebf3;
  }
  .bme-grade-title {
    font-weight: bold;
    font-size: 1.1em;
    color: #333;
    margin-bottom: 4px;
  }
  .bme-grade-code {
    font-size: 0.85em;
    color: #666;
  }
  .bme-grade-average-container {
    text-align: center;
    margin: 10px 0;
  }
  .bme-grade-average {
    font-size: 2.5em;
    font-weight: bold;
  }
  .bme-grade-coef {
    font-size: 0.9em;
    color: #888;
    margin-top: 4px;
  }
  .bme-grade-details {
    margin-top: auto;
    font-size: 0.9em;
    background: #f9f9f9;
    padding: 2px 10px;
    border-radius: 8px;
  }
  .bme-grade-detail-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px dashed #eee;
  }
  .bme-detail-left {
    display: flex;
    align-items: center;
  }
  .bme-detail-type {
    display: inline-block;
    width: 45px; /* Fixed width for alignment */
  }
  .bme-detail-coef {
    font-style: italic;
    color: #666;
  }
  .bme-grade-detail-row:last-child {
    border-bottom: none;
  }
  .bme-ue-header {
    grid-column: 1 / -1;
    background: #fff;
    border-left: 4px solid #0163DD;
    border: 1px solid #f0f0f0;
    border-left-width: 4px;
    padding: 12px 20px;
    margin: 30px 0 15px 0;
    border-radius: 8px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .bme-ue-info {
    display: flex;
    flex-direction: column;
  }
  .bme-ue-code {
    font-size: 0.9em;
    color: #666;
    font-weight: bold;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .bme-ue-name {
    font-size: 1.4em;
    color: #333;
    font-weight: bold;
  }
  .bme-ue-stats {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  .bme-ue-ects {
    display: inline-flex;
    align-items: center;
    background-color: #f0f7ff;
    color: #0163DD;
    border: 1px solid #d1e9ff;
    padding: 5px 14px;
    border-radius: 50px;
    font-weight: 700;
    font-size: 1.1em;
    letter-spacing: 0.5px;
    box-shadow: 0 2px 4px rgba(1, 99, 221, 0.08);
  }
  .bme-ue-average {
    background: #f3f4f6;
    color: #333;
    padding: 5px 15px;
    border-radius: 20px;
    font-weight: bold;
    font-size: 1.1em;
    border: 1px solid #e5e7eb;
  }
  `;
        document.head.appendChild(css);
    }

    /* Icônes */
    const BME_ICONS = {
        date: `<svg class="bme-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="2"/><line x1="7" y1="3" x2="7" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="17" y1="3" x2="17" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
        time: `<svg class="bme-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6v6h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
        room: `<svg class="bme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c4.2 0 8 3.22 8 8.2 0 3.32-2.67 7.25-8 11.8-5.33-4.55-8-8.48-8-11.8C4 5.22 7.8 2 12 2Zm0 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" fill="currentColor"/></svg>`,
        group: `<svg class="bme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C23 14.17 18.33 13 16 13ZM8 13c-2.67 0-8 1.34-8 4v2h8v-2c0-.7.25-1.37.7-2-.9-.32-1.8-.5-2.7-.5Z" fill="currentColor"/></svg>`,
        video: `<svg class="bme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2.2l3.8-2.5A1 1 0 0 1 23 7v10a1 1 0 0 1-1.2.9L17 15.4V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" fill="currentColor"/></svg>`,
        teacher: `<svg class="bme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5Z" fill="currentColor"/></svg>`,
        exam: `<svg class="bme-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`
    };

    /* Couleur par type */
    function getColorForType(type) {
        const t = (type || '').toUpperCase().trim();
        const fallback = '#0163DD';
        return (CALENDAR_EVENT_COLORS[t]?.border) || fallback;
    }

    /* Utils */
    function pickField(modal, labelPattern) {
        const title = Array.from(modal.querySelectorAll('.MuiTypography-body2'))
            .find(p => labelPattern.test((p.textContent || '').trim()));
        if (!title) return null;
        const nodes = [];
        let n = title.nextElementSibling;
        while (n && !n.classList.contains('MuiTypography-body2')) {
            nodes.push(n);
            n = n.nextElementSibling;
        }
        return { title, nodes };
    }

    function getGroups(modal) {
        const t = Array.from(modal.querySelectorAll('.MuiTypography-body2'))
            .find(p => /groupe/i.test(p.textContent || ''));
        if (!t) return { title: null, nodes: [], values: [] };

        const nodes = [];
        const values = [];
        let n = t.nextElementSibling;
        while (n && !n.classList.contains('MuiTypography-body2')) {
            if (n.matches('.MuiBox-root')) {
                // Try to find name in <p>, fallback to full text but exclude link text if possible
                const pTag = n.querySelector('p.MuiTypography-body1') || n.querySelector('p');
                let name = pTag ? pTag.textContent.trim() : n.textContent.trim();

                // Look for Teams link
                const link = n.querySelector('a[href*="teams"]');
                const url = link ? link.href : null;

                // Cleanup name if we have no pTag (and used full textContent) and we found a link
                if (!pTag && link && name.includes(link.textContent.trim())) {
                    name = name.replace(link.textContent.trim(), '').trim();
                }

                if (name) {
                    values.push({ name, url });
                }
            }
            nodes.push(n);
            n = n.nextElementSibling;
        }
        return { title: t, nodes, values };
    }

    function buildField({ label, icon, contentHTML = '' }) {
        const wrap = document.createElement('div');
        wrap.className = 'bme-field';
        const title = document.createElement('p');
        title.className = 'MuiTypography-root MuiTypography-body2 bme-field-title';
        title.innerHTML = `${icon}<span>${label}</span>`;
        const val = document.createElement('div');
        val.className = 'bme-field-value';
        if (contentHTML) val.innerHTML = contentHTML;
        wrap.appendChild(title); wrap.appendChild(val);
        return wrap;
    }

    whenItemLoaded('body', () => {
        const modalObserver = new MutationObserver((ml) => {
            ml.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (!(node instanceof Element)) return;
                    const modal = node.matches('.MuiCard-root') ? node : node.querySelector?.('.MuiCard-root');
                    if (!modal) return;
                    const closeBtn = modal.querySelector('.button-close');
                    if (!closeBtn) return;
                    enhanceModal(modal, closeBtn);
                });
            });
        });
        modalObserver.observe(document.documentElement, { childList: true, subtree: true });
    });

    function enhanceModal(modal, closeBtn) {
        if (modal.getAttribute('data-bme-modal') === '1') return;
        modal.setAttribute('data-bme-modal', '1');
        modal.classList.add('bme-modal');

        setTimeout(() => { (closeBtn || modal).focus?.(); }, 0);
        closeBtn.addEventListener('click', () => { setTimeout(() => { document.activeElement?.blur?.(); }, 0); }, { once: true });

        const contentHost = modal.querySelector('.MuiCardContent-root') || modal;

        /* Récupérer chip / titre */
        // Certains modals n’ajoutent pas la classe .course : on prend le premier chip si besoin
        let chip = modal.querySelector('.MuiChip-root.course') || modal.querySelector('.MuiChip-root');
        const titleEl =
            modal.querySelector('h2.MuiTypography-root') ||
            modal.querySelector('h3.MuiTypography-root') ||
            modal.querySelector('h1.MuiTypography-root');

        /* Détecter le type (CM/TD/TP/PRJ/IE/CTD/TD20/CTP) à partir du code module si possible */
        const codeModuleNode = Array.from(modal.querySelectorAll('.MuiTypography-root, p, span, div'))
            .find(el => /^code module\s*:/i.test((el.textContent || '').trim()));
        const codeModuleRaw = codeModuleNode?.textContent || '';
        // ex: "Code module : ST2ADB-2526PSA01CM (Cours magistral)"
        // → on garde l’identifiant entier mais on isole le suffixe CM/TD/TP/...
        const typeFromCode = (codeModuleRaw.match(/([A-Z]{2,3})(?=\s*\(|$)/) || [, ''])[1];
        let typeText = (typeFromCode || chip?.textContent || 'CM').toUpperCase();

        if (modal.textContent.includes('COURS.LANGUE')) {
            typeText = 'CLG';
        }
        if (modal.textContent.includes('COURS.COMM')) {
            typeText = 'COMM';
        }

        /* Couleur et libellé du chip (forcer CM/TD/TP/PRJ…) */
        modal.style.setProperty('--bme-color', getColorForType(typeText));
        if (chip) {
            chip.classList.add('bme-chip', `course-${typeText}`, 'chip-color');
            const lbl = chip.querySelector('.MuiChip-label');
            if (lbl) lbl.textContent = typeText; // remplace "COURS" par "CM"/"TD"/...
        } else {
            // Chip manquant : on le crée
            chip = document.createElement('div');
            chip.className = `MuiChip-root bme-chip chip-color course-${typeText}`;
            chip.innerHTML = `<span class="MuiChip-label">${typeText}</span>`;
        }

        /* Masquer la ligne type longue (“CTD (Cours TD)” / “CM (Cours magistral)”) PARTOUT */
        Array.from(modal.querySelectorAll('.MuiTypography-root, .MuiTypography-body2, p, span, div'))
            .filter(el => /\b(CM|TD|TP|CTD|TD20|CTP|PRJ|IE)\b\s*\(.+?\)/i.test((el.textContent || '').trim()))
            .forEach(el => el.classList.add('bme-hide'));

        /* Header : chip + titre, puis code module sous le titre (sans parenthèses descriptives) */
        const header = document.createElement('div');
        header.className = 'bme-header';

        const headerTop = document.createElement('div');
        headerTop.className = 'bme-header-top';
        if (chip) headerTop.appendChild(chip);
        if (titleEl) { titleEl.classList.add('bme-title-text'); headerTop.appendChild(titleEl); }
        header.appendChild(headerTop);

        let moduleId = '';
        const afterLabel = codeModuleRaw.replace(/^.*code module\s*:\s*/i, '');
        moduleId = (afterLabel.match(/^([A-Z0-9-]+)/) || [, ''])[1]
            // fallback si le libellé a disparu / structure différente
            || (codeModuleRaw.match(/\b([A-Z0-9]{2,}-[A-Z0-9-]{2,})\b/) || [, ''])[1]
            || '';

        const codeP = document.createElement('p');
        codeP.className = 'bme-code';
        codeP.textContent = moduleId;
        header.appendChild(codeP);

        // Masquer toute occurrence originale du code module
        Array.from(modal.querySelectorAll('.MuiTypography-root, p, span, div'))
            .filter(el => /^code module\s*:/i.test((el.textContent || '').trim()))
            .forEach(el => el.classList.add('bme-hide'));

        contentHost.insertBefore(header, contentHost.firstChild);

        /* Modalité */
        const modality = pickField(modal, /modalité/i);
        const modalityText = modality?.nodes?.[0]?.textContent?.trim() || '';
        if (modality) { modality.title.classList.add('bme-hide'); modality.nodes.forEach(n => n.classList.add('bme-hide')); }

        /* Champs pour la grille */
        const dateField = pickField(modal, /^date$/i);
        const timeField = pickField(modal, /^horaire/i);

        const roomTitle = Array.from(modal.querySelectorAll('.MuiTypography-body2')).find(p => /salle/i.test(p.textContent || ''));
        const roomBlock = roomTitle ? roomTitle.nextElementSibling : null;
        if (roomTitle) roomTitle.classList.add('bme-hide');
        if (roomBlock) roomBlock.classList.add('bme-hide');

        const groupsInfo = getGroups(modal);
        if (groupsInfo.title) groupsInfo.title.classList.add('bme-hide');
        groupsInfo.nodes.forEach(n => n.classList.add('bme-hide'));

        /* Intervenant(s) — garder les noms, ignorer chips/type */
        const teacherField = pickField(modal, /intervenant/i);
        let teacherHTML = '';
        if (teacherField) {
            teacherField.title.classList.add('bme-hide');
            const useful = teacherField.nodes.filter(n => {
                const txt = (n.textContent || '').trim();
                if (!txt) return false;
                if (n.classList.contains('MuiChip-root')) return false;
                if (/^\b(CM|TD|TP|CTD|TD20|CTP|PRJ|IE)\b$/i.test(txt)) return false;
                if (/\b(CM|TD|TP|CTD|TD20|CTP|PRJ|IE)\b\s*\(.+?\)/i.test(txt)) return false;
                return true;
            });
            teacherHTML = useful.map(n => n.outerHTML).join('');
            teacherField.nodes.forEach(n => n.classList.add('bme-hide'));
        }

        /* Grille 3×2 */
        const grid = document.createElement('div');
        grid.className = 'bme-grid';

        const dateHTML = (dateField && dateField.nodes.length) ? dateField.nodes.map(n => n.outerHTML).join('') : '';
        grid.appendChild(buildField({ label: 'Date', icon: BME_ICONS.date, contentHTML: dateHTML }));

        const timeHTML = (timeField && timeField.nodes.length) ? timeField.nodes.map(n => n.outerHTML).join('') : '';
        grid.appendChild(buildField({ label: 'Horaires', icon: BME_ICONS.time, contentHTML: timeHTML }));

        let roomHTML = '';
        if (/présentiel/i.test(modalityText)) {
            if (roomBlock) roomHTML = roomBlock.innerHTML;
        }
        else if (/distanciel|visio/i.test(modalityText)) {
            roomHTML = `${BME_ICONS.video}<span><b>Distanciel</b></span>`;
        }
        else if (roomBlock) {
            roomHTML = roomBlock.innerHTML;
        }
        grid.appendChild(buildField({ label: 'Salle', icon: BME_ICONS.room, contentHTML: roomHTML }));

        let groupsHTML = '';
        if (groupsInfo.values.length > 0) {
            groupsHTML = groupsInfo.values.map(grp => {
                const gName = grp.name;
                const teamsUrl = grp.url;

                let html = `<span class="MuiTypography-root MuiTypography-body1"><b>${gName}</b></span>`;
                if (teamsUrl) {
                    // Teams Icon wrapped in a clickable anchor
                    const teamsIcon = `
                    <a href="${teamsUrl}" target="_blank" title="Voir l'équipe Teams" style="display:inline-flex; align-items:center; color:#5b5fc7; margin-left:8px; text-decoration:none; transition: transform 0.2s;" onmouseenter="this.style.transform='scale(1.1)'" onmouseleave="this.style.transform='scale(1)'">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M16.5506 6.7392H15.9865C16.1974 6.37931 16.3082 5.97015 16.3077 5.55364C16.3079 5.15238 16.2057 4.75762 16.0106 4.40633C15.8156 4.05505 15.5341 3.75873 15.1925 3.54513C14.8508 3.33153 14.4603 3.20763 14.0574 3.18503C13.6545 3.16243 13.2524 3.24188 12.8888 3.41593C12.5227 2.8218 11.9579 2.37487 11.2935 2.15363C10.629 1.93238 9.90744 1.95097 9.25541 2.20611C8.60337 2.46126 8.06258 2.93665 7.72798 3.54883C7.39338 4.16101 7.28638 4.87082 7.42575 5.55364H3.19231C2.87609 5.55364 2.57282 5.67855 2.34922 5.90089C2.12562 6.12322 2 6.42477 2 6.7392V13.8526C2 14.167 2.12562 14.4686 2.34922 14.6909C2.57282 14.9132 2.87609 15.0381 3.19231 15.0381H5.92493C6.2818 15.9143 6.89389 16.6645 7.68262 17.1923C8.47135 17.7201 9.40071 18.0014 10.3514 18.0002C11.3021 17.999 12.2308 17.7153 13.0182 17.1856C13.8055 16.6558 14.4157 15.9041 14.7704 15.027C15.5147 14.9644 16.2082 14.6263 16.7137 14.0794C17.2193 13.5326 17.4999 12.817 17.5 12.0742V7.68321C17.4996 7.43296 17.3995 7.19308 17.2215 7.01613C17.0435 6.83918 16.8023 6.7396 16.5506 6.7392ZM10.3462 3.18252C10.7161 3.1825 11.077 3.29657 11.3791 3.50903C11.6811 3.72149 11.9095 4.02186 12.0327 4.36877C12.1559 4.71568 12.1678 5.09203 12.0669 5.44597C11.966 5.79992 11.7571 6.11402 11.4692 6.34501C11.3872 6.11385 11.2352 5.91364 11.0341 5.77192C10.833 5.6302 10.5926 5.55395 10.3462 5.55364H8.66053C8.56517 5.28546 8.5359 4.99844 8.57519 4.71668C8.61447 4.43492 8.72115 4.16664 8.88627 3.93436C9.0514 3.70208 9.27016 3.51258 9.52418 3.38175C9.7782 3.25093 10.0601 3.18261 10.3462 3.18252ZM6.76923 12.667C6.61112 12.667 6.45949 12.6046 6.34769 12.4934C6.23589 12.3822 6.17308 12.2314 6.17308 12.0742V9.11033H5.57692C5.41881 9.11033 5.26718 9.04787 5.15538 8.93671C5.04358 8.82554 4.98077 8.67476 4.98077 8.51755C4.98077 8.36033 5.04358 8.20956 5.15538 8.09839C5.26718 7.98722 5.41881 7.92477 5.57692 7.92477H7.96154C8.11965 7.92477 8.27128 7.98722 8.38308 8.09839C8.49488 8.20956 8.55769 8.36033 8.55769 8.51755C8.55769 8.67476 8.49488 8.82554 8.38308 8.93671C8.27128 9.04787 8.11965 9.11033 7.96154 9.11033H7.36538V12.0742C7.36538 12.2314 7.30258 12.3822 7.19078 12.4934C7.07897 12.6046 6.92734 12.667 6.76923 12.667ZM13.9231 13.2598C13.9228 14.0425 13.6629 14.8033 13.1836 15.4242C12.7043 16.0451 12.0324 16.4915 11.272 16.6941C10.5117 16.8967 9.70533 16.8442 8.978 16.5448C8.25068 16.2454 7.64299 15.7158 7.24914 15.0381H10.3462C10.6624 15.0381 10.9656 14.9132 11.1892 14.6909C11.4128 14.4686 11.5385 14.167 11.5385 13.8526V7.92477H13.9231V13.2598ZM13.9231 6.7392H12.7308C12.9655 6.42858 13.1364 6.07498 13.2336 5.69863C13.3307 5.32228 13.3523 4.93057 13.2971 4.54592C13.454 4.44925 13.6313 4.39011 13.815 4.37316C13.9988 4.3562 14.184 4.38189 14.3561 4.4482C14.5281 4.51451 14.6824 4.61964 14.8067 4.7553C14.9309 4.89096 15.0218 5.05345 15.0722 5.22998C15.1226 5.40651 15.1311 5.59226 15.097 5.77261C15.0629 5.95295 14.9872 6.12297 14.8758 6.26927C14.7644 6.41557 14.6204 6.53417 14.2897 6.69726 14.1076 6.73953 13.9231 6.7392ZM16.3077 12.0742C16.3077 12.4468 16.19 12.8099 15.9712 13.1124C15.7525 13.4148 15.4437 13.6414 15.0886 13.7599C15.1065 13.5938 15.1155 13.4269 15.1154 13.2598V7.92477H16.3077V12.0742Z" />
                        </svg>
                    </a>
                    `;
                    html += teamsIcon;
                }
                return `<div style="display:flex; align-items:center;">${html}</div>`;
            }).join('');
        }
        grid.appendChild(buildField({ label: 'Groupe', icon: BME_ICONS.group, contentHTML: groupsHTML }));

        const teacherCell = buildField({ label: 'Intervenant(s)', icon: BME_ICONS.teacher, contentHTML: teacherHTML });
        teacherCell.classList.add('bme-span-2');
        grid.appendChild(teacherCell);

        const dateTimeWrapper = modal.querySelector('.sc-dZeWys.sc-dmWEhm, .TvysB.MuiBox-root');
        if (dateTimeWrapper) dateTimeWrapper.classList.add('bme-hide');

        contentHost.insertBefore(grid, header.nextSibling);
    }
    // === Better MyEfrei — Grades Page Redesign ===

    // Add Exam Icon to BME_ICONS
    BME_ICONS.exam = `<svg class="bme-icon" viewBox="0 0 24 24" aria-hidden="true" style="color:#0163DD;"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" fill="currentColor"/></svg>`;
    BME_ICONS.sort = `<svg class="bme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z" fill="currentColor"/></svg>`;

    // --- PDF.js Logic ---

    // Ensure PDF.js is properly configured with the worker using multiple fallbacks
    async function loadPdfJsLibrary() {
        if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions.workerSrc) return window.pdfjsLib;
        if (!window.pdfjsLib) throw new Error('PDF.js not loaded (require failed)');

        console.log('BME: Configuring PDF.js worker...');

        const strategies = [
            // Strategy 1: GM_getResourceText (standard)
            () => {
                if (typeof GM_getResourceText === 'undefined') return null;
                const txt = GM_getResourceText('PDF_WORKER');
                return txt ? URL.createObjectURL(new Blob([txt], { type: 'text/javascript' })) : null;
            },
            // Strategy 2: GM_getResourceURL (direct url)
            () => (typeof GM_getResourceURL !== 'undefined' ? GM_getResourceURL('PDF_WORKER') : null),
            // Strategy 3: GM_xmlhttpRequest (CDN fetch)
            async () => {
                if (typeof GM_xmlhttpRequest === 'undefined') return null;
                return new Promise(resolve => {
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
                        onload: r => resolve(URL.createObjectURL(new Blob([r.responseText], { type: 'text/javascript' }))),
                        onerror: () => resolve(null)
                    });
                });
            }
        ];

        let workerSrc = null;
        for (const strategy of strategies) {
            try { workerSrc = await strategy(); } catch (e) { /* ignore */ }
            if (workerSrc) {
                console.log('BME: Worker loaded successfully via strategy');
                break;
            }
        }

        if (!workerSrc) throw new Error('Could not load PDF Worker via any method.');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
        return window.pdfjsLib;
    }

    // Modal Styles Map
    const PDF_STYLES = {
        modalOverlay: `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; display: flex; flex-direction: column; z-index: 1400; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); opacity: 0; transition: opacity 0.3s ease;`,
        header: `flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 15px 30px; border-bottom: 1px solid rgba(0,0,0,0.1); box-shadow: 0 2px 10px rgba(0,0,0,0.05); background: white;`,
        container: `flex: 1; overflow: auto; background: #e0e0e0; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 40px 0;`,
        btn: `border:none; background:white; width:32px; height:32px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: all 0.2s;`,
        dlBtn: `border: 1px solid #0163DD; background: #0163DD; color: white; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; display: flex; align-items: center; gap: 8px; transition: all 0.2s;`,
        loader: `display:flex; flex-direction:column; align-items:center; gap:15px; margin-top:100px;`
    };

    function openExamPdfJsModal(title, filePath, moduleName, examType) {
        // Cleanup existing
        document.getElementById('bme-pdf-modal')?.remove();

        // Date Parsing Logic
        // Expected format: "2025\04\26\20220655-TE601-DE-11000000-2025-03-22.PDF"
        // Publication Date: Start of string
        // Exam Date: End of string (before extension)

        let pubDateStr = '-';
        let examDateStr = '-';

        try {
            // Normalize path separators to forward slashes for easier split/regex
            const normalizedPath = filePath.replace(/\\/g, '/');
            const parts = normalizedPath.split('/');
            const filename = parts[parts.length - 1]; // "20220655-TE60...-2025-03-22.PDF"

            // Publication Date: First 3 parts if they look like YYYY/MM/DD
            // Or just parsing the beginning of the string string "2025\04\26"
            // Let's rely on standard path structure if consistent
            if (parts.length >= 3) {
                const y = parts[0];
                const m = parts[1];
                const d = parts[2];
                if (y.length === 4 && m.length === 2 && d.length === 2) {
                    pubDateStr = `${d}/${m}/${y}`;
                }
            }

            // Exam Date: Extract YYYY-MM-DD from end of filename
            const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
                const [y, m, d] = dateMatch[1].split('-');
                examDateStr = `${d}/${m}/${y}`;
            }
        } catch (e) { console.error('BME: Date parse error', e); }


        const wrapper = document.createElement('div');
        wrapper.id = 'bme-pdf-modal';
        wrapper.style.cssText = PDF_STYLES.modalOverlay;

        // Header with Modern Design
        // Left: Info (Copie, Module, Type)
        // Right: Dates + Actions
        wrapper.innerHTML = `
            <div style="${PDF_STYLES.header}">
                <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                    <div style="font-size: 1.1rem; font-weight: 700; color: #333; display: flex; align-items: center; gap: 8px;">
                        <span>Copie</span>
                        <div style="width: 4px; height: 4px; background: #bbb; border-radius: 50%;"></div>
                        <span style="color: #0163DD;">${moduleName || 'Module'}</span>
                    </div>
                    <div style="font-size: 0.9rem; color: #666; font-weight: 500;">
                        ${examType || 'Examen'}
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 24px;">
                   <div style="display: flex; flex-direction: column; gap: 2px; text-align: right; font-size: 0.8rem; color: #555; padding-right: 16px; border-right: 1px solid #eee;">
                        <div><span style="color:#888; margin-right:4px;">Examen du:</span> <strong>${examDateStr}</strong></div>
                        <div><span style="color:#888; margin-right:4px;">Publié le:</span> <strong>${pubDateStr}</strong></div>
                   </div>

                    <div style="display: flex; align-items: center; gap: 12px;">
                        <button id="bme-btn-reorder" title="Réorganiser les pages (Livret A3)" style="${PDF_STYLES.btn}">
                            ${BME_ICONS.sort}
                        </button>
                        <div style="width: 1px; height: 24px; background: #eee; margin: 0 4px;"></div>
                        <span id="bme-scale-val" style="font-variant-numeric: tabular-nums; font-weight: 500; color: #555; width: 45px; text-align: center;">100%</span>
                        <button id="bme-btn-out" title="Dézoomer" style="${PDF_STYLES.btn}"><svg viewBox="0 0 24 24" width="18" height="18" fill="#555"><path d="M19 13H5v-2h14v2z"/></svg></button>
                        <button id="bme-btn-in" title="Zoomer" style="${PDF_STYLES.btn}"><svg viewBox="0 0 24 24" width="18" height="18" fill="#555"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button>
                    </div>
                    <a id="bme-dl-link" href="#" target="_blank" style="text-decoration: none;">
                        <button style="${PDF_STYLES.dlBtn}">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path></svg>
                            Télécharger
                        </button>
                    </a>
                    <button id="bme-close" style="border: none; background: transparent; cursor: pointer; color: #666; display: flex; padding: 5px;">
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>
                    </button>
                </div>
            </div>
            <div id="bme-pdf-container" style="${PDF_STYLES.container}">
                <div id="bme-loader" style="${PDF_STYLES.loader}">
                    <div style="width: 40px; height: 40px; border: 4px solid #ddd; border-top-color: #0163DD; border-radius: 50%; animation: bme-spin 1s linear infinite;"></div>
                    <div style="color: #666; font-weight: 500;">Chargement de la copie...</div>
                </div>
                <style>@keyframes bme-spin { to { transform: rotate(360deg); } }</style>
            </div>
        `;

        document.body.style.overflow = 'hidden';
        document.body.appendChild(wrapper);
        requestAnimationFrame(() => wrapper.style.opacity = '1');

        // Logic Context
        // Logic Context
        const ctx = { pdf: null, scale: 1.0, rendering: false, reorder: false, renderGen: 0 };
        const container = wrapper.querySelector('#bme-pdf-container');
        const updateScaleUI = () => wrapper.querySelector('#bme-scale-val').textContent = Math.round(ctx.scale * 100) + '%';
        const reorderBtn = wrapper.querySelector('#bme-btn-reorder');
        const btnIn = wrapper.querySelector('#bme-btn-in');
        const btnOut = wrapper.querySelector('#bme-btn-out');

        // Helper: Calculate page sequence based on current mode
        const getPagesOrder = (numPages) => {
            const pages = Array.from({ length: numPages }, (_, i) => i + 1);
            if (!ctx.reorder) return pages;

            // Booklet Reordering Algorithm (1, 2, N-1, N, 3, 4, N-3, N-2...) based on user input
            const pairs = [];
            for (let i = 0; i < numPages; i += 2) {
                // Safely grab pairs (handle odd last page just in case)
                if (i + 1 < numPages) pairs.push([pages[i], pages[i + 1]]);
                else pairs.push([pages[i]]);
            }

            const evens = pairs.filter((_, i) => i % 2 === 0);
            const odds = pairs.filter((_, i) => i % 2 !== 0);

            // Logic: Even pairs come first (1-2, 3-4...), Odd pairs come last in reverse order (11-12, 9-10...)
            // Concat arrays of arrays then flatten
            const finalPairs = [...evens, ...odds.reverse()];
            return finalPairs.flat();
        };

        const render = async () => {
            if (!ctx.pdf) return;

            // Start new generation
            ctx.renderGen++;
            const myGen = ctx.renderGen;

            ctx.rendering = true;
            container.innerHTML = ''; // Clear for redraw

            const ratio = window.devicePixelRatio || 1;
            const pageSequence = getPagesOrder(ctx.pdf.numPages);

            try {
                for (const pageNum of pageSequence) {
                    // Check for cancellation
                    if (ctx.renderGen !== myGen) return;

                    try {
                        const page = await ctx.pdf.getPage(pageNum);

                        // Check again after async wait
                        if (ctx.renderGen !== myGen) return;

                        const viewport = page.getViewport({ scale: ctx.scale });

                        const div = document.createElement('div');
                        div.style.cssText = 'box-shadow: 0 4px 15px rgba(0,0,0,0.1); background: white; transition: all 0.2s; position: relative;';

                        const canvas = document.createElement('canvas');
                        canvas.width = Math.floor(viewport.width * ratio);
                        canvas.height = Math.floor(viewport.height * ratio);
                        canvas.style.cssText = `display:block; width: ${viewport.width}px; height: ${viewport.height}px;`;

                        div.appendChild(canvas);
                        container.appendChild(div);

                        await page.render({
                            canvasContext: canvas.getContext('2d'),
                            viewport,
                            transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null
                        }).promise;
                    } catch (e) {
                        // Ignore errors if cancelled
                        if (ctx.renderGen !== myGen) return;
                        console.error('BME: Page render error', pageNum, e);
                    }
                }
            } finally {
                // Only reset rendering flag if we are theoretically still the active generation
                // (Though strictly multiple running overlaps might exist, cleaner to just let the last one finish)
                if (ctx.renderGen === myGen) {
                    ctx.rendering = false;
                    updateScaleUI();

                    // Update button state visual
                    reorderBtn.style.color = ctx.reorder ? '#0163DD' : '#555';
                    reorderBtn.style.background = ctx.reorder ? '#eef6fc' : 'white';
                }
            }
        };

        // Events
        btnIn.onclick = () => { if (ctx.scale < 3) { ctx.scale += 0.25; render(); } };
        btnOut.onclick = () => { if (ctx.scale > 0.5) { ctx.scale -= 0.25; render(); } };

        reorderBtn.onclick = () => {
            // Immediate feedback
            ctx.reorder = !ctx.reorder;

            // Visual feedback instant (optimistic UI)
            reorderBtn.style.color = ctx.reorder ? '#0163DD' : '#555';
            reorderBtn.style.background = ctx.reorder ? '#eef6fc' : 'white';

            render();
        };

        const closeModal = () => {
            wrapper.style.opacity = '0';
            document.body.style.overflow = '';
            setTimeout(() => wrapper.remove(), 300);
        };
        wrapper.querySelector('#bme-close').onclick = closeModal;
        wrapper.addEventListener('click', e => { if (e.target === wrapper || e.target === container) closeModal(); });

        // Load PDF
        (async () => {
            try {
                const lib = await loadPdfJsLibrary();
                const res = await fetch(`https://www.myefrei.fr/api/rest/student/exam/file?pathname=${encodeURIComponent(filePath)}`);
                if (!res.ok) throw new Error('Fetch failed');

                // Filename logic
                let fname = `Copie_${(moduleName || 'Exam').replace(/[^a-z0-9]/gi, '_')}.pdf`;
                const disp = res.headers.get('Content-Disposition');
                const match = disp && disp.match(/filename="?([^"]+)"?/);
                if (match?.[1]) fname = match[1];
                else if (filePath) fname = filePath.replace(/\\/g, '/').split('/').pop() || fname;

                const blob = await res.blob();
                const url = URL.createObjectURL(blob);

                const link = wrapper.querySelector('#bme-dl-link');
                link.firstElementChild.onclick = () => { link.href = url; link.download = fname; };

                ctx.pdf = await lib.getDocument({ data: await blob.arrayBuffer() }).promise;
                container.innerHTML = '';
                await render();
            } catch (err) {
                console.error(err);
                container.innerHTML = `<div style="text-align:center; padding:40px; color:#d32f2f;"><h3>Erreur</h3><p>${err.message}</p></div>`;
            }
        })();
    }

    function renderGradesFromData(data, container) {
        if (!data || !data.grades || !data.grades.ues) return;

        container.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'bme-grade-grid';

        // Helper to format float or handle null
        // Rules: Max 2 decimals. Remove trailing zeros/dot. 16.00 -> 16, 16.70 -> 16.7, 19.067 -> 19.07
        const fmt = (v) => {
            if (v === null || v === undefined) return '-';

            let val = v;
            if (typeof val === 'string') {
                val = val.replace(',', '.');
            }

            const num = parseFloat(val);
            if (isNaN(num)) return v;
            const rounded = Math.round(num * 100) / 100;
            return rounded.toString().replace('.', ',');
        };

        const fmtECTS = (v) => {
            if (v === null || v === undefined) return null;
            const num = parseFloat(v);
            return isNaN(num) ? v : num.toString();
        };

        const fmtCoef = (v) => {
            if (v === null || v === undefined) return '';
            const num = parseFloat(v);
            if (isNaN(num)) return v;
            // Reduce decimals as much as possible, consistent with "0.2000" -> "0.2"
            return num.toString().replace('.', ',');
        };

        // === Debugging Data Structure ===
        console.log("BME: Received Data Object:", data);
        console.log("BME: Data Keys:", Object.keys(data));
        if (data.grades) console.log("BME: Grades Keys:", Object.keys(data.grades));
        if (data.rattrapages) console.log("BME: Rattrapages Type:", typeof data.rattrapages, data.rattrapages);

        // Concatenate standard UEs and "unaffectedModules" if present
        const allUEs = [...(data.grades.ues || [])];
        if (data.grades.unaffectedModules && data.grades.unaffectedModules.modules && data.grades.unaffectedModules.modules.length > 0) {
            allUEs.push({
                ...data.grades.unaffectedModules,
                isUnaffected: true // Flag to identify for styling
            });
        }

        // === Rattrapage Logic Refactored: Nested in Modules ===
        // No top-level injection needed as per new data structure finding.


        allUEs.forEach(ue => {
            // UE Header
            const ueHeader = document.createElement('div');
            ueHeader.className = 'bme-ue-header';

            // Unaffected Style Override
            if (ue.isUnaffected) {
                ueHeader.style.borderLeftColor = '#9e9e9e'; // Grey accent
                ueHeader.style.background = '#fafafa'; // Slightly different background
            }

            // ECTS Logic
            const earnedStr = fmtCoef(ue.ectsEarned);
            const attemptedStr = fmtCoef(ue.ectsAttempted);

            // Logic: if attempted exists, show "earned/attempted". If earned is empty/null, show "-".
            let ectsLabel = '';
            if (attemptedStr !== '') {
                const num = (earnedStr !== '') ? earnedStr : '-';
                ectsLabel = `${num}/${attemptedStr} ECTS`;
            }

            let statsHtml = '';
            // Only show stats if NOT unaffected
            if (!ue.isUnaffected) {
                if (ectsLabel) {
                    statsHtml += `<span class="bme-ue-ects">${ectsLabel}</span>`;
                }
                if (ue.grade !== null && ue.grade !== undefined) {
                    statsHtml += `<span class="bme-ue-average">${fmt(ue.grade)}</span>`;
                }
            }

            // UE Name/Code Parsing
            let displayCode = ue.code;
            let displayName = ue.name;

            // Only apply splitting logic if the code is the long internal format (starts with DIP)
            if (ue.code && ue.code.startsWith('DIP')) {
                if (displayName && displayName.includes(' - ')) {
                    const parts = displayName.split(' - ');
                    if (parts.length >= 2) {
                        displayCode = parts[0];
                        // Join the rest back in case there are multiple dashes
                        displayName = parts.slice(1).join(' - ');
                    }
                }
            }

            // Hide code for unaffected
            if (ue.isUnaffected) displayCode = '';

            ueHeader.innerHTML = `
                 <div class="bme-ue-info">
                     ${displayCode ? `<span class="bme-ue-code">${displayCode}</span>` : ''}
                     <span class="bme-ue-name">${displayName}</span>
                 </div>
                 <div class="bme-ue-stats">${statsHtml}</div>
              `;
            grid.appendChild(ueHeader);

            // Modules
            if (ue.modules) {
                ue.modules.forEach(mod => {
                    const card = document.createElement('div');
                    card.className = 'bme-grade-card';

                    const header = document.createElement('div');
                    header.className = 'bme-grade-header';
                    header.innerHTML = `
                         <div class="bme-grade-title">${mod.name}</div>
                         <div class="bme-grade-code">${mod.code}</div>
                      `;

                    // Teachers Display inside Header
                    if (mod.teachers && mod.teachers.length > 0) {
                        const tDiv = document.createElement('div');
                        tDiv.className = 'bme-grade-teachers';
                        tDiv.style.cssText = 'margin-top: 4px; font-size: 0.8rem; color: #666; display: flex; align-items: center; gap: 6px;';

                        if (mod.teachers.length > 2) {
                            tDiv.style.cursor = 'pointer';
                            tDiv.style.transition = 'opacity 0.2s';
                            tDiv.onmouseenter = () => tDiv.style.opacity = '0.7';
                            tDiv.onmouseleave = () => tDiv.style.opacity = '1';
                            tDiv.onclick = (e) => {
                                e.stopPropagation();
                                openTeacherPopover(e, mod.teachers, mod.name);
                            };
                        }

                        const iconContainer = document.createElement('div');
                        iconContainer.style.cssText = 'display: flex; opacity: 0.9;';
                        iconContainer.innerHTML = BME_ICONS.teacher || '';
                        const svg = iconContainer.querySelector('svg');
                        if (svg) {
                            svg.setAttribute('width', '14');
                            svg.setAttribute('height', '14');
                            svg.style.color = 'currentColor';
                        }

                        let label = mod.teachers[0];
                        let extraLabel = '';

                        if (mod.teachers.length === 2) {
                            label += `, ${mod.teachers[1]}`;
                        } else if (mod.teachers.length > 2) {
                            label += `, ${mod.teachers[1]}`;
                            extraLabel = ` (+${mod.teachers.length - 2})`;
                        }

                        const textSpan = document.createElement('span');
                        textSpan.textContent = label;
                        textSpan.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

                        tDiv.appendChild(iconContainer);
                        tDiv.appendChild(textSpan);

                        if (extraLabel) {
                            const extraSpan = document.createElement('span');
                            extraSpan.textContent = extraLabel;
                            extraSpan.style.cssText = 'font-weight: 600; opacity: 1; margin-left:2px;';
                            tDiv.appendChild(extraSpan);
                        }



                        header.appendChild(tDiv);
                    }
                    card.appendChild(header);


                    // Average
                    const avgContainer = document.createElement('div');
                    avgContainer.className = 'bme-grade-average-container';

                    const avgDiv = document.createElement('div');
                    avgDiv.className = 'bme-grade-average';
                    const avgVal = mod.grade !== null ? parseFloat(mod.grade) : null;
                    avgDiv.textContent = fmt(mod.grade);

                    if (avgVal !== null) {
                        if (avgVal < 10) avgDiv.style.color = '#d32f2f';
                        else if (avgVal < 12) avgDiv.style.color = '#f57c00';
                        else avgDiv.style.color = '#388e3c';
                    } else {
                        avgDiv.style.color = '#999';
                    }
                    avgContainer.appendChild(avgDiv);

                    if (mod.coef) {
                        const coefDiv = document.createElement('div');
                        coefDiv.className = 'bme-grade-coef';
                        coefDiv.textContent = `Coef: ${fmtCoef(mod.coef)}`;
                        avgContainer.appendChild(coefDiv);
                    }
                    card.appendChild(avgContainer);

                    // Details
                    const details = document.createElement('div');
                    details.className = 'bme-grade-details';

                    // Recursive function to render grades
                    const renderGradeList = (list, depth = 0) => {
                        if (!list || list.length === 0) return;

                        list.forEach(g => {
                            const row = document.createElement('div');
                            row.className = 'bme-grade-detail-row';

                            // Basic Styles for row
                            // We might want to add a class for subgrades if depth > 0

                            const detailType = g.courseActivity || g.type || 'N/A';

                            let examAction = '';
                            if (g.examFile) {
                                examAction = `
                                <div class="bme-exam-btn" style="cursor:pointer; display:flex; align-items:center; margin-left:12px; transition: transform 0.2s;" title="Voir la copie">
                                    ${BME_ICONS.exam}
                                </div>
                             `;
                            }

                            // Color logic
                            let gradeStyle = '';

                            // Sub-grade handling
                            let visualContent = '';
                            if (depth > 0) {
                                const subArrow = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="color:#bdbdbd; margin-right:6px; flex-shrink:0;"><path d="M19 15l-6 6-1.42-1.42L15.17 16H4V4h2v10h9.17l-3.59-3.58L13 9l6 6z"></path></svg>`;
                                visualContent = `
                                <div style="display:flex; align-items:center;">
                                    ${subArrow}
                                    <span class="bme-detail-type" style="font-size:0.95em;">${detailType}</span>
                                </div>
                             `;
                            } else {
                                visualContent = `<span class="bme-detail-type"><b>${detailType}</b></span>`;
                            }

                            row.innerHTML = `
                             <div class="bme-detail-left">
                                 ${visualContent}
                                 ${g.coef ? `<span class="bme-detail-coef">${fmtCoef(g.coef)}</span>` : ''}
                                 ${examAction}
                             </div>
                             <span>${fmt(g.grade)}</span>
                          `;

                            if (g.examFile) {
                                const btn = row.querySelector('.bme-exam-btn');
                                btn.onclick = (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openExamPdfJsModal(null, g.examFile, mod.name, detailType);
                                };
                                btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
                                btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
                            }

                            details.appendChild(row);

                            // Check for children
                            if (g.grades && g.grades.length > 0) {
                                renderGradeList(g.grades, depth + 1);
                            }
                        });
                    };

                    if (mod.grades) {
                        renderGradeList(mod.grades, 0);
                    }
                    card.appendChild(details);

                    // === Rattrapage Frame ===
                    // Use nested rattrapages from the module object directly
                    const rattrapagesData = mod.rattrapages;

                    if (rattrapagesData && rattrapagesData.length > 0) {
                        const frame = document.createElement('div');
                        frame.style.cssText = `
                            margin-top: 15px;
                            border: 1px solid #e0e0e0;
                            border-left: 4px solid #f57c00;
                            border-radius: 8px;
                            background: #fff8f3;
                            padding: 10px 15px;
                        `;

                        rattrapagesData.forEach(rt => {
                            const rtRow = document.createElement('div');
                            rtRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;';
                            if (rattrapagesData.indexOf(rt) === rattrapagesData.length - 1) rtRow.style.marginBottom = '0';

                            // Left: Label + Exam Icon
                            const left = document.createElement('div');
                            left.style.cssText = 'display: flex; align-items: center; gap: 8px;';

                            const label = document.createElement('span');
                            label.innerHTML = `<b>Rattrapage</b>`;
                            label.style.fontSize = '0.9em';
                            left.appendChild(label);

                            if (rt.examFile) {
                                const btn = document.createElement('div');
                                btn.style.cssText = 'cursor:pointer; display:flex; align-items:center; transition: transform 0.2s;';
                                btn.title = "Voir la copie";
                                btn.innerHTML = BME_ICONS.exam;
                                btn.onclick = (e) => {
                                    e.preventDefault(); e.stopPropagation();
                                    openExamPdfJsModal(null, rt.examFile, rt.name, "Rattrapage");
                                };
                                btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
                                btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
                                left.appendChild(btn);
                            }
                            rtRow.appendChild(left);

                            // Right: Grade
                            const right = document.createElement('div');
                            let color = '#333';
                            if (rt.grade !== null) {
                                const v = parseFloat(rt.grade);
                                if (!isNaN(v)) {
                                    if (v < 10) color = '#d32f2f'; // Red
                                    else color = '#388e3c'; // Green
                                }
                            }
                            right.textContent = fmt(rt.grade);
                            right.style.color = color;
                            right.style.fontWeight = 'bold';
                            rtRow.appendChild(right);

                            frame.appendChild(rtRow);
                        });

                        card.appendChild(frame);
                    }
                    grid.appendChild(card);
                });
            }
        });

        container.appendChild(grid);
    }

    whenItemLoaded('table.MuiTable-root', (table) => {
        // Only on grades page (check title or URL)
        if (!location.href.includes('/grades')) {
            const title = document.querySelector('h1');
            if (!title || !title.textContent.includes('Notes')) return;
        }

        // Avoid double processing
        if (table.getAttribute('data-bme-replaced') === '1') return;

        // Hide original table
        table.style.display = 'none';
        table.setAttribute('data-bme-replaced', '1');

        // Prepare our container
        // Use a class-based approach to handle potential re-renders where multiple containers might exist temporarily
        let container = document.createElement('div');
        container.className = 'bme-grades-custom-container';
        table.parentNode.appendChild(container);

        const updateView = (data) => {
            if (data) {
                renderGradesFromData(data, container);
            }
        };

        if (latestGradesData) {
            updateView(latestGradesData);
        } else {
            // Try to fetch default ONLY if we haven't successfully intercepted anything yet
            if (!w.bmeHasFetchedDefault) {
                w.bmeHasFetchedDefault = true;
                fetchDefaultGrades().then(data => {
                    // Only apply if we still don't have fresh data from interceptor
                    if (!latestGradesData && data) {
                        latestGradesData = data;
                        updateView(data);
                    }
                });
            }
        }
    });

    // Global listener for updates - Updates ALL existing containers (handles duplicates/zombies safely)
    // This ensures that when a semester changes, ALL current grade views are updated.
    if (!w.bmeGradesListenerAdded) {
        w.addEventListener('bme-grades-update', (e) => {
            console.log('BME: Updating all grade containers with new data');
            const containers = document.querySelectorAll('.bme-grades-custom-container');
            containers.forEach(c => renderGradesFromData(e.detail, c));
        });
        w.bmeGradesListenerAdded = true;
    }

})();

// --- Teacher Popover Logic ---
function openTeacherPopover(event, teachers, moduleName) {
    // Remove existing
    document.getElementById('bme-teacher-popover')?.remove();

    const popover = document.createElement('div');
    popover.id = 'bme-teacher-popover';

    // Glassmorphism Styles
    popover.style.cssText = `
        position: absolute;
        z-index: 10000;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        padding: 16px;
        min-width: 200px;
        max-width: 300px;
        font-family: 'Roboto', sans-serif;
        animation: bme-fade-in 0.2s ease-out;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'font-weight: bold; color: #333; margin-bottom: 12px; font-size: 0.95rem; border-bottom: 1px solid #eee; padding-bottom: 8px;';
    header.textContent = 'Intervenants';
    popover.appendChild(header);

    // List
    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-direction: column; gap: 6px; max-height: 300px; overflow-y: auto;';

    teachers.forEach(t => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #555;';
        item.innerHTML = `
            <div style="width: 6px; height: 6px; background: #0163DD; border-radius: 50%;"></div>
            <span>${t}</span>
        `;
        list.appendChild(item);
    });
    popover.appendChild(list);

    // Calculate Position (Relative to document for absolute positioning)
    const rect = event.currentTarget.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    let top = rect.bottom + scrollY + 10;
    let left = rect.left + scrollX;

    // Adjust if off-screen
    if (rect.left + 250 > window.innerWidth) left = (window.innerWidth - 270) + scrollX;

    // Check vertical overflow (viewport relative)
    if (rect.bottom + 200 > window.innerHeight) {
        top = (rect.top + scrollY) - 200;
    }

    popover.style.top = top + 'px';
    popover.style.left = left + 'px';

    // Close logic
    const close = (e) => {
        if (!popover.contains(e.target) && e.target !== event.currentTarget) {
            popover.remove();
            document.removeEventListener('click', close);
        }
    };

    // Slight delay to avoid immediate close from bubble event
    setTimeout(() => document.addEventListener('click', close), 50);

    document.body.appendChild(popover);
}

// Add keyframes for fade-in
if (!document.getElementById('bme-popover-anim')) {
    const s = document.createElement('style');
    s.id = 'bme-popover-anim';
    s.textContent = `@keyframes bme-fade-in { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }`;
    document.head.appendChild(s);
}

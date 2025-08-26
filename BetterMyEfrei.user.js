// ==UserScript==
// @name         Better MyEfrei
// @namespace    https://www.myefrei.fr/
// @version      0.4.0
// @description  some improvements to MyEfrei UI!
// @author       DocSystem & Doryan D.
// @match        https://www.myefrei.fr/portal/student/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=www.myefrei.fr
// @grant        none
// @updateURL    https://github.com/DocSystem/BetterMyEfrei/raw/refs/heads/main/BetterMyEfrei.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Markers to avoid reprocessing
    const PROCESSED_ATTR = 'data-bme-processed';

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
            chipColor: '#000000'
        }
    };
    CALENDAR_EVENT_COLORS.CTD = CALENDAR_EVENT_COLORS.TD;
    CALENDAR_EVENT_COLORS.CTP = CALENDAR_EVENT_COLORS.TP;
    for (let key of Object.keys(CALENDAR_EVENT_COLORS)) {
        CUSTOM_CSS += `.course.course-${key}:not(.chip-color) { background-color: ${CALENDAR_EVENT_COLORS[key].normal} !important; }`;
        CUSTOM_CSS += `.course.course-${key}:not(.chip-color):hover { background-color: ${CALENDAR_EVENT_COLORS[key].hover} !important; }`;
        CUSTOM_CSS += `.course.course-${key}:not(.chip-color):active { background-color: ${CALENDAR_EVENT_COLORS[key].active} !important; }`;
        CUSTOM_CSS += `.course.course-${key}.event-border { border-color: ${CALENDAR_EVENT_COLORS[key].border} !important; }`;
        CUSTOM_CSS += `.course.course-${key}.chip-color { background-color: ${CALENDAR_EVENT_COLORS[key].border} !important; color: ${CALENDAR_EVENT_COLORS[key].chipColor}; }`;
    }
    if (!document.querySelector(`#${CUSTOM_CSS_ID}`)) {
        const cssElem = document.createElement('style');
        cssElem.id = CUSTOM_CSS_ID;
        cssElem.innerHTML = CUSTOM_CSS;
        document.querySelector('head').appendChild(cssElem);
    }

    // === Better MyEfrei — Legend enhancer ===
    (function () {
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
            ['CM',  'CM (Cours magistral)'],
            ['CTD', 'CTD (Cours TD)'],
            ['TD',  'TD (Travaux dirigés)'],
            ['CTP', 'CTP (Cours TP)'],
            ['TP',  'TP (Travaux pratiques)'],
            ['PRJ', 'PRJ (Projet)'],
            ['TPA', 'TPA (Travaux pratiques en autonomie)'],
            ['IE',  'IE (Intervention Entreprise)'],
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
            panel.querySelectorAll('.type-item.course').forEach(n => n.remove());
            panel.querySelectorAll('.type-item.event').forEach(n => n.remove());  // pas d'« Évènement »
            panel.querySelectorAll('.type-item.exam').forEach(n => n.remove());   // supprime l'existant pour éviter la pastille en double

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
        obs.observe(document.documentElement, { childList:true, subtree:true });
        enhanceLegend();
    })();


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
                const newText = String(eventData.courseActivity ?? '').trim();
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

        // --- Désactiver le scroll auto et fixer l'offset par défaut à 07:30 ---
        function scrollTo0730OncePerPeriod() {
            const timeContent = document.querySelector('.rbc-time-content');
            if (!timeContent) return;

            // Clé de période (semaine/jour) : on lit le libellé d'en-tête pour ne pas reseter ton scroll à chaque micro-rendu
            const periodKey = document.querySelector('.label-date p')?.textContent?.trim()
                || document.querySelector('.rbc-time-header-content')?.textContent?.trim()
                || 'unknown-period';

            // Si on a déjà positionné pour cette période, on ne retouche pas (respect du scroll manuel)
            if (timeContent.getAttribute('data-bme-period-key') === periodKey &&
                timeContent.getAttribute('data-bme-scrolled') === '1') {
                return;
            }

            const gutter = timeContent.querySelector('.rbc-time-gutter');
            const groups = gutter ? Array.from(gutter.querySelectorAll('.rbc-timeslot-group')) : [];
            if (!gutter || groups.length === 0) return;

            // Trouver le bloc "7"
            let idx7 = -1;
            for (let i = 0; i < groups.length; i++) {
                const lbl = groups[i].querySelector('.rbc-label')?.textContent?.trim();
                if (lbl === '7') { idx7 = i; break; }
            }

            // Calcul de la hauteur d'une heure
            let hourTop = 0, hourHeight = 0;
            if (idx7 >= 0) {
                const g7 = groups[idx7];
                const nextTop = (groups[idx7 + 1]?.offsetTop ?? (g7.offsetTop + g7.getBoundingClientRect().height));
                hourTop = g7.offsetTop;
                hourHeight = nextTop - g7.offsetTop;
            } else {
                // secours : distribution régulière si pas de label "7"
                const totalH = gutter.scrollHeight;
                hourHeight = totalH / 24;
                hourTop = hourHeight * 7;
            }

            // 07:30 => + 0.5 * heure
            const target = Math.max(0, hourTop + hourHeight * 0.5);

            // Plusieurs passes rapides pour contrer un éventuel scroll ultérieur de React
            const apply = () => { timeContent.scrollTop = target; };
            apply();
            setTimeout(apply, 50);
            setTimeout(apply, 150);

            // Marqueurs pour ne pas re-scroller pendant cette période
            timeContent.setAttribute('data-bme-period-key', periodKey);
            timeContent.setAttribute('data-bme-scrolled', '1');
        }

        // Initial pass on already-present events
        document.querySelectorAll('.event-week.event-border').forEach(processEventCard);

        // Initial global calendar processing
        processCalendar();
        scrollTo0730OncePerPeriod();

        // Efficiently handle only NEW nodes
        const calendarObserver = new MutationObserver((mutationList) => {
            // Process calendar globally
            processCalendar();
            scrollTo0730OncePerPeriod();

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

    // === Better MyEfrei — Nettoyage en-tête Planning & remontée des blocs ===
    (function () {
        const CSS_ID = 'bme-planning-cleanup';
        if (!document.querySelector('#' + CSS_ID)) {
            const css = document.createElement('style');
            css.id = CSS_ID;
            css.textContent = `
      /* 1) Cacher uniquement le titre "Planning" */
      .MuiContainer-root[role="title"] { display: none !important; }

      /* 2) Remonter les sections principales (colonne de gauche + calendrier) */
      .sc-dZeWys.cGYehn.MuiBox-root,
      .sc-jnWwQn.omXKR { margin-top: 0 !important; }

      /* 3) Compacter la barre d’outils du calendrier */
      .sc-laFCIP.gtqZmr { margin-top: 0 !important; }
    `;
            document.head.appendChild(css);
        }

        function cleanupPlanning() {
            // Supprime seulement le titre
            document.querySelector('.MuiContainer-root[role="title"]')?.remove();

            // Aligne les colonnes en haut si leur parent est en flex
            const leftCol = document.querySelector('.sc-dZeWys.cGYehn.MuiBox-root');
            const calWrap = document.querySelector('.sc-jnWwQn.omXKR');
            const parent = leftCol?.parentElement || calWrap?.parentElement;
            if (parent) parent.style.alignItems = 'flex-start';
        }

        // Au chargement + si la page re-render
        cleanupPlanning();
        const mo = new MutationObserver(cleanupPlanning);
        mo.observe(document.body, { childList: true, subtree: true });
    })();

    // === Better MyEfrei — Déplacer l’alerte iCal tout en bas ===
    (function () {
        const ALERT_SEL = '.MuiAlert-root[role="alert"]';
        const WRAPPER_SEL = '.sc-bkrxz.dUSWYm'; // conteneur principal de la page

        function moveIcalAlert() {
            const alert = document.querySelector(ALERT_SEL);
            if (!alert) return;

            const wrapper =
                  alert.closest(WRAPPER_SEL) ||
                  document.querySelector(WRAPPER_SEL) ||
                  document.body;

            // Déjà en bas ? on ne fait rien
            if (!wrapper || wrapper.lastElementChild === alert) return;

            // Déplace l'élément existant (sans modifier sa structure) à la fin du wrapper
            wrapper.appendChild(alert);
        }

        // 1) Au chargement
        moveIcalAlert();

        // 2) Si React réinsère l'alerte ailleurs, on la remet en bas
        const mo = new MutationObserver(() => moveIcalAlert());
        mo.observe(document.body, { childList: true, subtree: true });
    })();

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

  .bme-modal .MuiTypography-body1,
  .bme-modal .MuiTypography-body2 { line-height:1.35; margin:0; }
  `;
        document.head.appendChild(css);
    }

    /* Icônes */
    const BME_ICONS = {
        date: `<svg class="bme-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="2"/><line x1="7" y1="3" x2="7" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="17" y1="3" x2="17" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
        time: `<svg class="bme-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6v6h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
        room: `<svg class="bme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c4.2 0 8 3.22 8 8.2 0 3.32-2.67 7.25-8 11.8-5.33-4.55-8-8.48-8-11.8C4 5.22 7.8 2 12 2Zm0 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" fill="currentColor"/></svg>`,
        group:`<svg class="bme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C23 14.17 18.33 13 16 13ZM8 13c-2.67 0-8 1.34-8 4v2h8v-2c0-.7.25-1.37.7-2-.9-.32-1.8-.5-2.7-.5Z" fill="currentColor"/></svg>`,
        video:`<svg class="bme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2.2l3.8-2.5A1 1 0 0 1 23 7v10a1 1 0 0 1-1.2.9L17 15.4V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" fill="currentColor"/></svg>`,
        teacher:`<svg class="bme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5Z" fill="currentColor"/></svg>`
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
            if (n.matches('.MuiBox-root') && n.textContent.trim()) values.push(n.textContent.trim());
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
        modalObserver.observe(document.documentElement, { childList:true, subtree:true });
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

        /* Détecter le type (CM/TD/TP/PRJ/IE/CTD/CTP) à partir du code module si possible */
        const codeModuleNode = Array.from(modal.querySelectorAll('.MuiTypography-root, p, span, div'))
        .find(el => /^code module\s*:/i.test((el.textContent || '').trim()));
        const codeModuleRaw = codeModuleNode?.textContent || '';
        // ex: "Code module : ST2ADB-2526PSA01CM (Cours magistral)"
        // → on garde l’identifiant entier mais on isole le suffixe CM/TD/TP/...
        const typeFromCode = (codeModuleRaw.match(/([A-Z]{2,3})(?=\s*\(|$)/) || [,''])[1];
        const typeText = (typeFromCode || chip?.textContent || 'CM').toUpperCase();

        /* Couleur et libellé du chip (forcer CM/TD/TP/PRJ…) */
        modal.style.setProperty('--bme-color', getColorForType(typeText));
        if (chip) {
            chip.classList.add('bme-chip', `course-${typeText}`, 'chip-color');
            const lbl = chip.querySelector('.MuiChip-label');
            if (lbl) lbl.textContent = typeText;      // remplace "COURS" par "CM"/"TD"/...
        } else {
            // Chip manquant : on le crée
            chip = document.createElement('div');
            chip.className = `MuiChip-root bme-chip chip-color course-${typeText}`;
            chip.innerHTML = `<span class="MuiChip-label">${typeText}</span>`;
        }

        /* Masquer la ligne type longue (“CTD (Cours TD)” / “CM (Cours magistral)”) PARTOUT */
        Array.from(modal.querySelectorAll('.MuiTypography-root, .MuiTypography-body2, p, span, div'))
            .filter(el => /\b(CM|TD|TP|CTD|CTP|PRJ|IE)\b\s*\(.+?\)/i.test((el.textContent || '').trim()))
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
        moduleId = (afterLabel.match(/^([A-Z0-9-]+)/) || [,''])[1]
        // fallback si le libellé a disparu / structure différente
        || (codeModuleRaw.match(/\b([A-Z0-9]{2,}-[A-Z0-9-]{2,})\b/) || [,''])[1]
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
                if (/^\b(CM|TD|TP|CTD|CTP|PRJ|IE)\b$/i.test(txt)) return false;
                if (/\b(CM|TD|TP|CTD|CTP|PRJ|IE)\b\s*\(.+?\)/i.test(txt)) return false;
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
        if (/présentiel/i.test(modalityText))        { if (roomBlock) roomHTML = roomBlock.innerHTML; }
        else if (/distanciel|visio/i.test(modalityText)) { roomHTML = `${BME_ICONS.video}<span><b>Distanciel</b></span>`; }
        else if (roomBlock)                           { roomHTML = roomBlock.innerHTML; }
        grid.appendChild(buildField({ label: 'Salle', icon: BME_ICONS.room, contentHTML: roomHTML }));

        const groupsHTML = (groupsInfo.values.length)
        ? groupsInfo.values.map(g => `<span class="MuiTypography-root MuiTypography-body1">${g}</span>`).join('')
        : '';
        grid.appendChild(buildField({ label: 'Groupe', icon: BME_ICONS.group, contentHTML: groupsHTML }));

        const teacherCell = buildField({ label: 'Intervenant(s)', icon: BME_ICONS.teacher, contentHTML: teacherHTML });
        teacherCell.classList.add('bme-span-2');
        grid.appendChild(teacherCell);

        const dateTimeWrapper = modal.querySelector('.sc-dZeWys.sc-dmWEhm, .TvysB.MuiBox-root');
        if (dateTimeWrapper) dateTimeWrapper.classList.add('bme-hide');

        contentHost.insertBefore(grid, header.nextSibling);
    }


})();

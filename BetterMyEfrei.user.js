// ==UserScript==
// @name         Better MyEfrei
// @namespace    https://www.myefrei.fr/
// @version      0.1.0
// @description  some improvements to MyEfrei UI!
// @author       DocSystem
// @match        https://www.myefrei.fr/portal/student/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=www.myefrei.fr
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Markers to avoid reprocessing
    const PROCESSED_ATTR = 'data-bme-processed';

    let CUSTOM_CSS = ``;
    const CUSTOM_CSS_ID = 'bme-custom-css';

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
            normal: '#FFF2F8',
            hover: '#FFE2EF',
            active: '#FFC7E0',
            border: '#AA1055',
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

        // Initial pass on already-present events
        document.querySelectorAll('.event-week.event-border').forEach(processEventCard);

        // Initial global calendar processing
        processCalendar();

        // Efficiently handle only NEW nodes
        const calendarObserver = new MutationObserver((mutationList) => {
            // Process calendar globally
            processCalendar();

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
})();
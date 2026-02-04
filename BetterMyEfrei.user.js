// ==UserScript==
// @name         Better MyEfrei
// @namespace    https://www.myefrei.fr/
// @version      0.7.0
// @description  Some improvements to MyEfrei UI!
// @author       DocSystem & Doryan D. & Mathu_lmn & Mat15 & RemiVibert
// @match        https://www.myefrei.fr/portal/student/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=www.myefrei.fr


// @updateURL    https://github.com/DocSystem/BetterMyEfrei/raw/refs/heads/main/BetterMyEfrei.user.js
// @downloadURL  https://github.com/DocSystem/BetterMyEfrei/raw/refs/heads/main/BetterMyEfrei.user.js
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

    // === Better MyEfrei — Settings System (by RemiVibert) ===
    // Système de configuration persistant avec localStorage
    const BME_SETTINGS_KEY = 'bme-settings';

    // Couleurs par défaut des événements (identiques aux CALENDAR_EVENT_COLORS d'origine)
    const BME_DEFAULT_EVENT_COLORS = {
        CM: { normal: '#E2FFEF', hover: '#C4FFDE', active: '#84FFBA', border: '#20D772', chipColor: '#000000' },
        TD: { normal: '#E2EFFF', hover: '#CCE2FF', active: '#92C1FB', border: '#0163DD', chipColor: '#FFFFFF' },
        TP: { normal: '#FFF3E9', hover: '#FFE0C5', active: '#FFC48F', border: '#F17300', chipColor: '#FFFFFF' },
        PRJ: { normal: '#FDECEC', hover: '#F8D1D1', active: '#F2A9A9', border: '#8B0000', chipColor: '#FFFFFF' },
        TPA: { normal: '#F4F4F4', hover: '#E2E2E2', active: '#CDCDCD', border: '#666256', chipColor: '#FFFFFF' },
        IE: { normal: '#F4EBFF', hover: '#E9D8FF', active: '#DBC0FF', border: '#C198F8', chipColor: '#FFFFFF' },
        CLG: { normal: '#E2EFFF', hover: '#CCE2FF', active: '#92C1FB', border: '#0163DD', chipColor: '#FFFFFF' },
        COMM: { normal: '#E2EFFF', hover: '#CCE2FF', active: '#92C1FB', border: '#0163DD', chipColor: '#FFFFFF' },
        EXAM: { normal: '#FFE8F1', hover: '#FFD4E5', active: '#FFB0CC', border: '#FF7EB8', chipColor: '#FFFFFF' }
    };

    const BME_DEFAULT_SETTINGS = {
        planning: {
            startTime: 7.5,  // 7h30 en décimal (7 + 30/60)
            endTime: 20      // 20h00
        },
        showProfilePicture: true,
        eventColors: JSON.parse(JSON.stringify(BME_DEFAULT_EVENT_COLORS))
    };

    // Charger les settings depuis localStorage ou utiliser les valeurs par défaut
    function loadSettings() {
        try {
            const stored = localStorage.getItem(BME_SETTINGS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Fusion profonde pour préserver les valeurs par défaut manquantes
                const result = JSON.parse(JSON.stringify(BME_DEFAULT_SETTINGS));
                if (parsed.planning) {
                    result.planning = { ...result.planning, ...parsed.planning };
                }
                if (parsed.showProfilePicture !== undefined) {
                    result.showProfilePicture = parsed.showProfilePicture;
                }
                if (parsed.eventColors) {
                    // Fusionner chaque type d'événement
                    for (const [key, colors] of Object.entries(parsed.eventColors)) {
                        if (result.eventColors[key]) {
                            result.eventColors[key] = { ...result.eventColors[key], ...colors };
                        } else {
                            result.eventColors[key] = colors;
                        }
                    }
                }
                return result;
            }
        } catch (e) {
            console.error('BME: Error loading settings', e);
        }
        return JSON.parse(JSON.stringify(BME_DEFAULT_SETTINGS));
    }

    // Sauvegarder les settings dans localStorage
    function saveSettings(settings) {
        try {
            localStorage.setItem(BME_SETTINGS_KEY, JSON.stringify(settings));
            // Émettre un événement pour notifier les composants
            w.dispatchEvent(new CustomEvent('bme-settings-update', { detail: settings }));
        } catch (e) {
            console.error('BME: Error saving settings', e);
        }
    }

    // Settings global accessible
    let bmeSettings = loadSettings();

    // Convertir temps décimal en heures:minutes
    function decimalToTime(decimal) {
        const hours = Math.floor(decimal);
        const minutes = Math.round((decimal - hours) * 60);
        return `${hours}h${minutes.toString().padStart(2, '0')}`;
    }

    // Convertir temps décimal en { hour, minutes }
    function decimalToHourMinutes(decimal) {
        const hour = Math.floor(decimal);
        const minutes = Math.round((decimal - hour) * 60);
        return { hour, minutes };
    }

    // === Better MyEfrei — Settings Menu UI (by RemiVibert) ===
    const BME_SETTINGS_CSS_ID = 'bme-settings-css';
    if (!document.querySelector(`#${BME_SETTINGS_CSS_ID}`)) {
        const css = document.createElement('style');
        css.id = BME_SETTINGS_CSS_ID;
        css.textContent = `
    /* Overlay de la popup */
    .bme-settings-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: all 0.2s ease;
    }
    .bme-settings-overlay.open {
        opacity: 1;
        visibility: visible;
    }

    /* Popup de settings - style natif MyEfrei */
    .bme-settings-popup {
        background: white;
        border-radius: 8px;
        width: 420px;
        max-width: 92vw;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        transform: translateY(10px);
        transition: all 0.2s ease;
    }
    .bme-settings-popup.wide {
        width: 580px;
    }
    .bme-settings-overlay.open .bme-settings-popup {
        transform: translateY(0);
    }

    /* Header de la popup - style sobre */
    .bme-settings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
        background: #f8fafc;
    }
    .bme-settings-header h2 {
        margin: 0;
        color: #163767;
        font-size: 1rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .bme-settings-header h2 svg {
        width: 20px;
        height: 20px;
        fill: #163767;
    }
    .bme-settings-close {
        background: transparent;
        border: 1px solid #d1d5db;
        width: 28px;
        height: 28px;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
        color: #6b7280;
    }
    .bme-settings-close:hover {
        background: #f3f4f6;
        border-color: #9ca3af;
    }
    .bme-settings-close svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
    }

    /* Contenu de la popup */
    .bme-settings-content {
        padding: 20px;
    }

    /* Section */
    .bme-settings-section {
        margin-bottom: 20px;
    }
    .bme-settings-section:last-child {
        margin-bottom: 0;
    }
    .bme-settings-section-title {
        font-size: 0.8rem;
        font-weight: 500;
        color: #6b7280;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .bme-settings-section-title svg {
        width: 16px;
        height: 16px;
        fill: #6b7280;
    }

    /* Dual Range Slider */
    .bme-time-slider-container {
        padding: 12px 16px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
    }

    /* Custom dual slider */
    .bme-dual-slider {
        position: relative;
        height: 6px;
        margin: 8px 0 0 0;
    }
    .bme-slider-track {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 6px;
        background: #e5e7eb;
        border-radius: 3px;
    }
    .bme-slider-range {
        position: absolute;
        top: 0;
        height: 6px;
        background: #163767;
        border-radius: 3px;
    }
    .bme-slider-thumb {
        position: absolute;
        top: 50%;
        width: 18px;
        height: 18px;
        background: white;
        border: 2px solid #163767;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        cursor: grab;
        transition: box-shadow 0.15s ease;
        z-index: 2;
    }
    .bme-slider-thumb:hover {
        box-shadow: 0 0 0 4px rgba(22, 55, 103, 0.1);
    }
    .bme-slider-thumb:active,
    .bme-slider-thumb.dragging {
        cursor: grabbing;
        box-shadow: 0 0 0 6px rgba(22, 55, 103, 0.15);
    }

    /* Labels et ticks sur la même ligne */
    .bme-slider-labels-row {
        display: flex;
        align-items: center;
        margin-top: 10px;
        padding: 0;
        position: relative;
        height: 20px;
    }
    .bme-slider-tick-left {
        font-size: 0.75rem;
        color: #9ca3af;
        position: absolute;
        left: 0;
    }
    .bme-slider-tick-right {
        font-size: 0.75rem;
        color: #9ca3af;
        position: absolute;
        right: 0;
    }
    .bme-slider-value-label {
        position: absolute;
        font-size: 0.75rem;
        font-weight: 600;
        color: #163767;
        background: #eef3f8;
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid #d1d5db;
        transform: translateX(-50%);
        white-space: nowrap;
    }

    /* Footer - style bouton "Aujourd'hui" */
    .bme-settings-footer {
        padding: 12px 20px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        background: #f8fafc;
    }
    .bme-settings-footer button {
        padding: 6px 14px;
        border-radius: 4px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .bme-btn-reset {
        background: white;
        border: 1px solid #d1d5db;
        color: #374151;
    }
    .bme-btn-reset:hover {
        background: #f9fafb;
        border-color: #9ca3af;
    }
    .bme-btn-save {
        background: white;
        border: 1px solid #163767;
        color: #163767;
    }
    .bme-btn-save:hover {
        background: #163767;
        color: white;
    }

    /* Pages du menu */
    .bme-settings-page {
        display: none;
    }
    .bme-settings-page.active {
        display: block;
    }

    /* Bouton de navigation (thème) */
    .bme-nav-button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 12px 14px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
        font-size: 0.875rem;
        color: #374151;
    }
    .bme-nav-button:hover {
        background: #f9fafb;
        border-color: #d1d5db;
    }
    .bme-nav-button-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .bme-nav-button-content svg {
        width: 18px;
        height: 18px;
        fill: #6b7280;
    }
    .bme-nav-button-arrow {
        width: 16px;
        height: 16px;
        fill: #9ca3af;
        transition: transform 0.15s ease;
    }
    .bme-nav-button:hover .bme-nav-button-arrow {
        transform: translateX(2px);
    }

    /* Toggle switch */
    .bme-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
    }
    .bme-toggle-label {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.875rem;
        color: #374151;
    }
    .bme-toggle-label svg {
        width: 18px;
        height: 18px;
        fill: #6b7280;
    }
    .bme-toggle {
        position: relative;
        width: 40px;
        height: 22px;
        background: #e5e7eb;
        border-radius: 11px;
        cursor: pointer;
        transition: background 0.2s ease;
    }
    .bme-toggle.active {
        background: #163767;
    }
    .bme-toggle::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 18px;
        height: 18px;
        background: white;
        border-radius: 50%;
        transition: transform 0.2s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .bme-toggle.active::after {
        transform: translateX(18px);
    }

    /* Bouton retour */
    .bme-back-button {
        background: transparent;
        border: none;
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        color: #6b7280;
        font-size: 0.875rem;
        padding: 0;
        transition: color 0.15s ease;
    }
    .bme-back-button:hover {
        color: #374151;
    }
    .bme-back-button svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
    }

    /* Page thème - Layout avec preview */
    .bme-theme-layout {
        display: flex;
        gap: 24px;
    }
    .bme-theme-list {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .bme-theme-preview {
        width: 180px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
        position: sticky;
        top: 0;
    }
    .bme-theme-preview-title {
        font-size: 0.75rem;
        color: #6b7280;
        text-align: center;
        margin-bottom: 4px;
    }

    /* Aperçu réaliste d'un événement */
    .bme-preview-event-wrapper {
        border-radius: 6px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .bme-preview-event {
        padding: 10px 12px;
        border-left: 4px solid;
        min-height: 90px;
        display: flex;
        flex-direction: column;
        transition: background-color 0.15s ease;
        cursor: pointer;
        user-select: none;
    }
    .bme-preview-event:active {
        /* L'état active est géré dynamiquement via JS */
    }
    .bme-preview-event-header {
        display: flex;
        align-items: center;
        margin-bottom: 6px;
    }
    .bme-preview-chip {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.65rem;
        font-weight: 600;
    }
    .bme-preview-event-title {
        font-weight: 600;
        font-size: 0.8rem;
        color: #1f2937;
        margin-bottom: 4px;
        line-height: 1.3;
    }
    .bme-preview-event-info {
        font-size: 0.7rem;
        color: #6b7280;
    }
    .bme-preview-state {
        font-size: 0.65rem;
        color: #9ca3af;
        text-align: center;
        margin-top: 8px;
        margin-top: 4px;
    }

    /* Item de couleur d'événement */
    .bme-color-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .bme-color-item:hover {
        border-color: #d1d5db;
        background: #fafafa;
    }
    .bme-color-item.expanded {
        border-color: #163767;
        border-radius: 6px 6px 0 0;
    }
    .bme-color-item-header {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
    }
    .bme-color-dot {
        width: 20px;
        height: 20px;
        border-radius: 4px;
        border: 2px solid;
        flex-shrink: 0;
    }
    .bme-color-item-name {
        font-size: 0.8rem;
        font-weight: 500;
        color: #374151;
    }
    .bme-color-item-actions {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .bme-color-reset-btn {
        padding: 4px 8px;
        font-size: 0.65rem;
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        cursor: pointer;
        color: #6b7280;
        transition: all 0.15s ease;
    }
    .bme-color-reset-btn:hover {
        background: #e5e7eb;
        color: #374151;
    }
    .bme-color-item-arrow {
        width: 14px;
        height: 14px;
        fill: #9ca3af;
        transition: transform 0.2s ease;
    }
    .bme-color-item.expanded .bme-color-item-arrow {
        transform: rotate(90deg);
    }

    /* Panneau de couleurs étendu */
    .bme-color-panel {
        display: none;
        padding: 12px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-top: none;
        border-radius: 0 0 6px 6px;
    }
    .bme-color-panel.open {
        display: block;
    }
    .bme-color-main-picker {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
    }
    .bme-color-main-picker label {
        font-size: 0.75rem;
        color: #6b7280;
        flex-shrink: 0;
        min-width: 60px;
    }
    .bme-color-input-wrapper {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1;
    }
    .bme-color-input {
        width: 32px;
        height: 32px;
        padding: 0;
        border: 2px solid #d1d5db;
        border-radius: 4px;
        cursor: pointer;
        background: transparent;
    }
    .bme-color-input::-webkit-color-swatch-wrapper {
        padding: 2px;
    }
    .bme-color-input::-webkit-color-swatch {
        border-radius: 2px;
        border: none;
    }
    .bme-color-hex {
        width: 75px;
        padding: 5px 8px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 0.75rem;
        font-family: monospace;
    }

    /* Mode avancé */
    .bme-advanced-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.7rem;
        color: #6b7280;
        cursor: pointer;
        margin-bottom: 8px;
    }
    .bme-advanced-toggle input {
        cursor: pointer;
    }
    .bme-advanced-colors {
        display: none;
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;
    }
    .bme-advanced-colors.open {
        display: grid;
    }
    .bme-advanced-color-item {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }
    .bme-advanced-color-item label {
        font-size: 0.65rem;
        color: #6b7280;
    }
    .bme-advanced-color-row {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .bme-advanced-color-input {
        width: 24px;
        height: 24px;
        padding: 0;
        border: 1px solid #d1d5db;
        border-radius: 3px;
        cursor: pointer;
    }
    .bme-advanced-color-input::-webkit-color-swatch-wrapper {
        padding: 1px;
    }
    .bme-advanced-color-input::-webkit-color-swatch {
        border-radius: 2px;
        border: none;
    }
    .bme-advanced-hex {
        flex: 1;
        padding: 3px 5px;
        border: 1px solid #d1d5db;
        border-radius: 3px;
        font-size: 0.65rem;
        font-family: monospace;
        min-width: 0;
        max-width: 70px;
    }
`;
        document.head.appendChild(css);
    }

    // Créer le menu de settings (popup uniquement, accessible via le menu profil)
    function createSettingsMenu() {
        // Vérifier si déjà créé
        if (document.querySelector('.bme-settings-overlay')) return;

        // Overlay et popup (sans bouton flottant - accès via menu profil)
        const overlay = document.createElement('div');
        overlay.className = 'bme-settings-overlay';
        overlay.innerHTML = `
            <div class="bme-settings-popup">
                <div class="bme-settings-header">
                    <h2>
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
                        </svg>
                        <span id="bme-header-title">Better MyEfrei</span>
                    </h2>
                    <button class="bme-settings-close" title="Fermer">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>

                <!-- Page principale -->
                <div class="bme-settings-page active" id="bme-page-main">
                    <div class="bme-settings-content">
                        <!-- Section plage horaire -->
                        <div class="bme-settings-section">
                            <div class="bme-settings-section-title">
                                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                                </svg>
                                Plage horaire du planning
                            </div>
                            <div class="bme-time-slider-container">
                                <div class="bme-dual-slider" id="bme-dual-slider">
                                    <div class="bme-slider-track"></div>
                                    <div class="bme-slider-range" id="bme-slider-range"></div>
                                    <div class="bme-slider-thumb" id="bme-thumb-start" data-type="start"></div>
                                    <div class="bme-slider-thumb" id="bme-thumb-end" data-type="end"></div>
                                </div>
                                <div class="bme-slider-labels-row">
                                    <span class="bme-slider-tick-left">0h</span>
                                    <span class="bme-slider-value-label" id="bme-start-label">${decimalToTime(bmeSettings.planning.startTime)}</span>
                                    <span class="bme-slider-value-label" id="bme-end-label">${decimalToTime(bmeSettings.planning.endTime)}</span>
                                    <span class="bme-slider-tick-right">23h45</span>
                                </div>
                            </div>
                        </div>

                        <!-- Section thème -->
                        <div class="bme-settings-section">
                            <div class="bme-settings-section-title">
                                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                                </svg>
                                Apparence
                            </div>
                            <button class="bme-nav-button" id="bme-btn-theme">
                                <span class="bme-nav-button-content">
                                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M17.5 12a1.5 1.5 0 01-1.5-1.5A1.5 1.5 0 0117.5 9a1.5 1.5 0 011.5 1.5 1.5 1.5 0 01-1.5 1.5m-3-4A1.5 1.5 0 0113 6.5 1.5 1.5 0 0114.5 5 1.5 1.5 0 0116 6.5 1.5 1.5 0 0114.5 8m-5 0A1.5 1.5 0 018 6.5 1.5 1.5 0 019.5 5 1.5 1.5 0 0111 6.5 1.5 1.5 0 019.5 8m-3 4A1.5 1.5 0 015 10.5 1.5 1.5 0 016.5 9 1.5 1.5 0 018 10.5 1.5 1.5 0 016.5 12M12 3a9 9 0 00-9 9 9 9 0 009 9 1.5 1.5 0 001.5-1.5c0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16a5 5 0 005-5c0-4.42-4.03-8-9-8z"/>
                                    </svg>
                                    Couleurs des événements
                                </span>
                                <svg class="bme-nav-button-arrow" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                                </svg>
                            </button>
                        </div>

                        <!-- Section profil -->
                        <div class="bme-settings-section">
                            <div class="bme-settings-section-title">
                                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                </svg>
                                Profil
                            </div>
                            <div class="bme-toggle-row">
                                <span class="bme-toggle-label">
                                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                    </svg>
                                    Afficher la photo de profil
                                </span>
                                <div class="bme-toggle ${bmeSettings.showProfilePicture ? 'active' : ''}" id="bme-toggle-profile-pic"></div>
                            </div>
                        </div>
                    </div>
                    <div class="bme-settings-footer">
                        <button class="bme-btn-reset" id="bme-btn-reset">Réinitialiser</button>
                        <button class="bme-btn-save" id="bme-btn-save">Enregistrer</button>
                    </div>
                </div>

                <!-- Page thème -->
                <div class="bme-settings-page" id="bme-page-theme">
                    <div class="bme-settings-content">
                        <button class="bme-back-button" id="bme-btn-back">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                            </svg>
                            Retour
                        </button>
                        <div class="bme-theme-layout">
                            <div class="bme-theme-list" id="bme-theme-list">
                                <!-- Liste des types d'événements générée dynamiquement -->
                            </div>
                            <div class="bme-theme-preview">
                                <div class="bme-theme-preview-title">Aperçu</div>
                                <div class="bme-preview-event-wrapper" id="bme-preview-wrapper">
                                    <div class="bme-preview-event" id="bme-preview-event">
                                        <div class="bme-preview-event-header">
                                            <span class="bme-preview-chip" id="bme-preview-chip">CM</span>
                                        </div>
                                        <div class="bme-preview-event-title">Exemple de cours</div>
                                        <div class="bme-preview-event-info">Bat. A A101</div>
                                    </div>
                                </div>
                                <div class="bme-preview-state" id="bme-preview-state">État normal</div>
                            </div>
                        </div>
                    </div>
                    <div class="bme-settings-footer">
                        <button class="bme-btn-save" id="bme-btn-save-theme">Appliquer</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Variables pour le slider
        let tempSettings = { ...bmeSettings };
        let isDragging = false;
        let currentThumb = null;

        const slider = document.getElementById('bme-dual-slider');
        const thumbStart = document.getElementById('bme-thumb-start');
        const thumbEnd = document.getElementById('bme-thumb-end');
        const range = document.getElementById('bme-slider-range');
        const startLabel = document.getElementById('bme-start-label');
        const endLabel = document.getElementById('bme-end-label');
        const labelsRow = document.querySelector('.bme-slider-labels-row');

        const MAX_TIME = 23.75; // 23h45 max (24h cause des bugs)

        // Fonction pour convertir position en valeur (0-23h45)
        function positionToValue(pos, sliderWidth) {
            const rawValue = (pos / sliderWidth) * MAX_TIME;
            // Aimantation toutes les 15 minutes (0.25h)
            return Math.min(Math.round(rawValue * 4) / 4, MAX_TIME);
        }

        // Fonction pour convertir valeur en position
        function valueToPosition(value, sliderWidth) {
            return (value / MAX_TIME) * sliderWidth;
        }

        // Mettre à jour l'affichage du slider
        function updateSliderUI() {
            const sliderRect = slider.getBoundingClientRect();
            const sliderWidth = sliderRect.width;
            const labelsRowWidth = labelsRow.getBoundingClientRect().width;

            const startPos = valueToPosition(tempSettings.planning.startTime, sliderWidth);
            const endPos = valueToPosition(tempSettings.planning.endTime, sliderWidth);

            thumbStart.style.left = `${startPos}px`;
            thumbEnd.style.left = `${endPos}px`;
            range.style.left = `${startPos}px`;
            range.style.width = `${endPos - startPos}px`;

            startLabel.textContent = decimalToTime(tempSettings.planning.startTime);
            endLabel.textContent = decimalToTime(tempSettings.planning.endTime);

            // Positionnement des labels sous les curseurs (tenir compte du padding de 12px)
            const labelPadding = 12;
            const startLabelPos = startPos + labelPadding;
            const endLabelPos = endPos + labelPadding;

            // Largeur des labels et des ticks pour la détection de collision
            const startLabelWidth = startLabel.offsetWidth;
            const endLabelWidth = endLabel.offsetWidth;
            const tickLeftWidth = document.querySelector('.bme-slider-tick-left').offsetWidth;
            const tickRightWidth = document.querySelector('.bme-slider-tick-right').offsetWidth;

            // Limites pour éviter de chevaucher 0h et 23h45
            const minGap = 4; // Espace minimum entre les éléments
            const minBoundary = tickLeftWidth + minGap + (startLabelWidth / 2);
            const maxBoundary = labelsRowWidth - tickRightWidth - minGap - (endLabelWidth / 2);

            // Collision detection entre les deux labels
            const centerDistance = endLabelPos - startLabelPos;
            const minDistance = (startLabelWidth / 2) + (endLabelWidth / 2) + minGap;

            let finalStartPos = startLabelPos;
            let finalEndPos = endLabelPos;

            if (centerDistance < minDistance) {
                // Les labels se chevauchent, on les décale
                const midPoint = (startLabelPos + endLabelPos) / 2;
                finalStartPos = midPoint - minDistance / 2;
                finalEndPos = midPoint + minDistance / 2;
            }

            // S'assurer que les labels restent dans les limites (ne pas chevaucher 0h et 23h45)
            finalStartPos = Math.max(minBoundary, Math.min(finalStartPos, maxBoundary - minDistance));
            finalEndPos = Math.min(maxBoundary, Math.max(finalEndPos, minBoundary + minDistance));

            startLabel.style.left = `${finalStartPos}px`;
            endLabel.style.left = `${finalEndPos}px`;
        }

        // Gérer le drag
        function handleDragStart(e, thumb) {
            e.preventDefault();
            isDragging = true;
            currentThumb = thumb;
            thumb.classList.add('dragging');
            document.addEventListener('mousemove', handleDragMove);
            document.addEventListener('mouseup', handleDragEnd);
            document.addEventListener('touchmove', handleDragMove, { passive: false });
            document.addEventListener('touchend', handleDragEnd);
        }

        function handleDragMove(e) {
            if (!isDragging || !currentThumb) return;
            e.preventDefault();

            const sliderRect = slider.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let pos = clientX - sliderRect.left;
            pos = Math.max(0, Math.min(pos, sliderRect.width));

            const value = positionToValue(pos, sliderRect.width);
            const type = currentThumb.dataset.type;

            if (type === 'start') {
                // Le curseur de début ne peut pas dépasser celui de fin
                tempSettings.planning.startTime = Math.min(value, tempSettings.planning.endTime - 0.25);
            } else {
                // Le curseur de fin ne peut pas être avant celui de début
                tempSettings.planning.endTime = Math.max(value, tempSettings.planning.startTime + 0.25);
            }

            updateSliderUI();
        }

        function handleDragEnd() {
            if (currentThumb) {
                currentThumb.classList.remove('dragging');
            }
            currentThumb = null;
            document.removeEventListener('mousemove', handleDragMove);
            document.removeEventListener('mouseup', handleDragEnd);
            document.removeEventListener('touchmove', handleDragMove);
            document.removeEventListener('touchend', handleDragEnd);
            // Retarder la remise à false de isDragging pour éviter que le click sur l'overlay ne ferme la popup
            setTimeout(() => {
                isDragging = false;
            }, 50);
        }

        // Event listeners pour les thumbs
        thumbStart.addEventListener('mousedown', (e) => handleDragStart(e, thumbStart));
        thumbStart.addEventListener('touchstart', (e) => handleDragStart(e, thumbStart), { passive: false });
        thumbEnd.addEventListener('mousedown', (e) => handleDragStart(e, thumbEnd));
        thumbEnd.addEventListener('touchstart', (e) => handleDragStart(e, thumbEnd), { passive: false });

        // === Navigation entre pages ===
        const pageMain = document.getElementById('bme-page-main');
        const pageTheme = document.getElementById('bme-page-theme');
        const headerTitle = document.getElementById('bme-header-title');
        const popup = overlay.querySelector('.bme-settings-popup');

        function showPage(page) {
            pageMain.classList.remove('active');
            pageTheme.classList.remove('active');
            if (page === 'main') {
                pageMain.classList.add('active');
                headerTitle.textContent = 'Better MyEfrei';
                popup.classList.remove('wide');
            } else if (page === 'theme') {
                pageTheme.classList.add('active');
                headerTitle.textContent = 'Couleurs';
                popup.classList.add('wide');
                renderThemeList();
            }
        }

        document.getElementById('bme-btn-theme').addEventListener('click', () => showPage('theme'));
        document.getElementById('bme-btn-back').addEventListener('click', () => showPage('main'));

        // === Toggle photo de profil ===
        const toggleProfilePic = document.getElementById('bme-toggle-profile-pic');
        toggleProfilePic.addEventListener('click', () => {
            tempSettings.showProfilePicture = !tempSettings.showProfilePicture;
            toggleProfilePic.classList.toggle('active', tempSettings.showProfilePicture);
        });

        // === Système de thème ===
        const EVENT_TYPE_NAMES = {
            CM: 'CM (Cours magistral)',
            TD: 'TD (Travaux dirigés)',
            TP: 'TP (Travaux pratiques)',
            PRJ: 'PRJ (Projet)',
            TPA: 'TPA (TP en autonomie)',
            IE: 'IE (Évaluation)',
            CLG: 'CLG (Cours de langue)',
            COMM: 'COMM (Communication)'
        };

        let selectedEventType = 'CM';
        let expandedPanel = null;

        // Calculer les couleurs secondaires à partir d'une couleur principale
        function generateColorsFromBase(baseColor) {
            // Convertir hex en HSL
            const hex = baseColor.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16) / 255;
            const g = parseInt(hex.substr(2, 2), 16) / 255;
            const b = parseInt(hex.substr(4, 2), 16) / 255;

            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h, s, l = (max + min) / 2;

            if (max === min) {
                h = s = 0;
            } else {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                    case g: h = ((b - r) / d + 2) / 6; break;
                    case b: h = ((r - g) / d + 4) / 6; break;
                }
            }

            // Fonction pour convertir HSL en hex
            function hslToHex(h, s, l) {
                let r, g, b;
                if (s === 0) {
                    r = g = b = l;
                } else {
                    const hue2rgb = (p, q, t) => {
                        if (t < 0) t += 1;
                        if (t > 1) t -= 1;
                        if (t < 1/6) return p + (q - p) * 6 * t;
                        if (t < 1/2) return q;
                        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                        return p;
                    };
                    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                    const p = 2 * l - q;
                    r = hue2rgb(p, q, h + 1/3);
                    g = hue2rgb(p, q, h);
                    b = hue2rgb(p, q, h - 1/3);
                }
                const toHex = x => {
                    const hex = Math.round(x * 255).toString(16);
                    return hex.length === 1 ? '0' + hex : hex;
                };
                return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
            }

            // Calculer la luminosité relative pour déterminer la couleur du texte du chip
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            const chipColor = luminance > 0.5 ? '#000000' : '#FFFFFF';

            // Générer les couleurs
            // Normal: couleur de base très claire (haute luminosité)
            const normalL = Math.min(0.95, l + (1 - l) * 0.7);
            const normal = hslToHex(h, s * 0.6, normalL);

            // Hover: un peu plus saturé et moins clair
            const hoverL = Math.min(0.9, normalL - 0.05);
            const hover = hslToHex(h, s * 0.7, hoverL);

            // Active: encore plus visible
            const activeL = Math.min(0.85, hoverL - 0.1);
            const active = hslToHex(h, s * 0.8, activeL);

            // Border: la couleur de base elle-même (saturée)
            const border = baseColor.toUpperCase();

            return { normal, hover, active, border, chipColor };
        }

        // Mettre à jour la prévisualisation
        let previewColors = null;
        function updatePreview() {
            const colors = tempSettings.eventColors[selectedEventType];
            if (!colors) return;
            previewColors = colors;

            const previewEvent = document.getElementById('bme-preview-event');
            const previewChip = document.getElementById('bme-preview-chip');
            const previewState = document.getElementById('bme-preview-state');

            // État normal par défaut
            previewEvent.style.backgroundColor = colors.normal;
            previewEvent.style.borderColor = colors.border;

            // Chip
            previewChip.style.backgroundColor = colors.border;
            previewChip.style.color = colors.chipColor;
            previewChip.textContent = selectedEventType;

            // Reset state label
            previewState.textContent = 'Survolez ou cliquez';
        }

        // Ajouter les interactions hover/active à la prévisualisation
        function setupPreviewInteractions() {
            const previewEvent = document.getElementById('bme-preview-event');
            const previewState = document.getElementById('bme-preview-state');

            previewEvent.addEventListener('mouseenter', () => {
                if (previewColors) {
                    previewEvent.style.backgroundColor = previewColors.hover;
                    previewState.textContent = 'Au survol';
                }
            });

            previewEvent.addEventListener('mouseleave', () => {
                if (previewColors) {
                    previewEvent.style.backgroundColor = previewColors.normal;
                    previewState.textContent = 'Survolez ou cliquez';
                }
            });

            previewEvent.addEventListener('mousedown', (e) => {
                e.preventDefault();
                if (previewColors) {
                    previewEvent.style.backgroundColor = previewColors.active;
                    previewState.textContent = 'Au clic';
                }
            });

            previewEvent.addEventListener('mouseup', () => {
                if (previewColors) {
                    previewEvent.style.backgroundColor = previewColors.hover;
                    previewState.textContent = 'Au survol';
                }
            });
        }

        // Générer la liste des types d'événements
        function renderThemeList() {
            const container = document.getElementById('bme-theme-list');
            container.innerHTML = '';

            for (const [type, name] of Object.entries(EVENT_TYPE_NAMES)) {
                const colors = tempSettings.eventColors[type] || BME_DEFAULT_EVENT_COLORS[type];
                if (!colors) continue;

                const itemWrapper = document.createElement('div');
                itemWrapper.className = 'bme-color-item-wrapper';
                itemWrapper.innerHTML = `
                    <div class="bme-color-item" data-type="${type}">
                        <div class="bme-color-item-header">
                            <div class="bme-color-dot" style="background-color: ${colors.normal}; border-color: ${colors.border};"></div>
                            <span class="bme-color-item-name">${name}</span>
                        </div>
                        <div class="bme-color-item-actions">
                            <button class="bme-color-reset-btn" data-type="${type}" title="Réinitialiser">↺</button>
                            <svg class="bme-color-item-arrow" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                            </svg>
                        </div>
                    </div>
                    <div class="bme-color-panel" data-type="${type}">
                        <div class="bme-color-main-picker">
                            <label>Couleur</label>
                            <div class="bme-color-input-wrapper">
                                <input type="color" class="bme-color-input" data-type="${type}" data-prop="border" value="${colors.border}">
                                <input type="text" class="bme-color-hex" data-type="${type}" data-prop="border" value="${colors.border}">
                            </div>
                        </div>
                        <label class="bme-advanced-toggle">
                            <input type="checkbox" data-type="${type}"> Mode avancé
                        </label>
                        <div class="bme-advanced-colors" data-type="${type}">
                            <div class="bme-advanced-color-item">
                                <label>Normal</label>
                                <div class="bme-advanced-color-row">
                                    <input type="color" class="bme-advanced-color-input" data-type="${type}" data-prop="normal" value="${colors.normal}">
                                    <input type="text" class="bme-advanced-hex" data-type="${type}" data-prop="normal" value="${colors.normal}">
                                </div>
                            </div>
                            <div class="bme-advanced-color-item">
                                <label>Survol</label>
                                <div class="bme-advanced-color-row">
                                    <input type="color" class="bme-advanced-color-input" data-type="${type}" data-prop="hover" value="${colors.hover}">
                                    <input type="text" class="bme-advanced-hex" data-type="${type}" data-prop="hover" value="${colors.hover}">
                                </div>
                            </div>
                            <div class="bme-advanced-color-item">
                                <label>Actif</label>
                                <div class="bme-advanced-color-row">
                                    <input type="color" class="bme-advanced-color-input" data-type="${type}" data-prop="active" value="${colors.active}">
                                    <input type="text" class="bme-advanced-hex" data-type="${type}" data-prop="active" value="${colors.active}">
                                </div>
                            </div>
                            <div class="bme-advanced-color-item">
                                <label>Bordure/Chip</label>
                                <div class="bme-advanced-color-row">
                                    <input type="color" class="bme-advanced-color-input" data-type="${type}" data-prop="border" value="${colors.border}">
                                    <input type="text" class="bme-advanced-hex" data-type="${type}" data-prop="border" value="${colors.border}">
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(itemWrapper);
            }

            // Event listeners pour les boutons reset individuels
            container.querySelectorAll('.bme-color-reset-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const type = btn.dataset.type;
                    if (BME_DEFAULT_EVENT_COLORS[type]) {
                        tempSettings.eventColors[type] = JSON.parse(JSON.stringify(BME_DEFAULT_EVENT_COLORS[type]));
                        renderThemeList();
                        updatePreview();
                    }
                });
            });

            // Event listeners pour les items
            container.querySelectorAll('.bme-color-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.closest('.bme-color-panel') || e.target.closest('.bme-color-reset-btn')) return;
                    const type = item.dataset.type;
                    selectedEventType = type;
                    updatePreview();

                    // Toggle panel
                    const panel = item.nextElementSibling;
                    const wasExpanded = panel.classList.contains('open');

                    // Fermer tous les panels
                    container.querySelectorAll('.bme-color-panel').forEach(p => p.classList.remove('open'));
                    container.querySelectorAll('.bme-color-item').forEach(i => i.classList.remove('expanded'));

                    if (!wasExpanded) {
                        panel.classList.add('open');
                        item.classList.add('expanded');
                    }
                });
            });

            // Event listeners pour les color pickers principaux
            container.querySelectorAll('.bme-color-input').forEach(input => {
                input.addEventListener('input', (e) => {
                    const type = e.target.dataset.type;
                    const color = e.target.value;

                    // Mettre à jour l'input hex associé
                    const hexInput = container.querySelector(`.bme-color-hex[data-type="${type}"][data-prop="border"]`);
                    if (hexInput) hexInput.value = color.toUpperCase();

                    // Vérifier si le mode avancé est actif
                    const advancedCheckbox = container.querySelector(`.bme-advanced-toggle input[data-type="${type}"]`);
                    if (!advancedCheckbox || !advancedCheckbox.checked) {
                        // Mode simple: générer toutes les couleurs automatiquement
                        const newColors = generateColorsFromBase(color);
                        tempSettings.eventColors[type] = newColors;

                        // Mettre à jour les inputs avancés
                        ['normal', 'hover', 'active', 'border'].forEach(prop => {
                            const advInput = container.querySelector(`.bme-advanced-color-input[data-type="${type}"][data-prop="${prop}"]`);
                            const advHex = container.querySelector(`.bme-advanced-hex[data-type="${type}"][data-prop="${prop}"]`);
                            if (advInput) advInput.value = newColors[prop];
                            if (advHex) advHex.value = newColors[prop];
                        });

                        // Mettre à jour le dot
                        const dot = container.querySelector(`.bme-color-item[data-type="${type}"] .bme-color-dot`);
                        if (dot) {
                            dot.style.backgroundColor = newColors.normal;
                            dot.style.borderColor = newColors.border;
                        }
                    } else {
                        // Mode avancé: ne changer que la bordure
                        tempSettings.eventColors[type].border = color.toUpperCase();
                    }

                    updatePreview();
                });

                // Empêcher la propagation du clic
                input.addEventListener('click', e => e.stopPropagation());
            });

            // Event listeners pour les inputs hex
            container.querySelectorAll('.bme-color-hex').forEach(input => {
                input.addEventListener('input', (e) => {
                    let value = e.target.value.trim();
                    if (!value.startsWith('#')) value = '#' + value;
                    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                        const colorInput = container.querySelector(`.bme-color-input[data-type="${e.target.dataset.type}"]`);
                        if (colorInput) {
                            colorInput.value = value;
                            colorInput.dispatchEvent(new Event('input'));
                        }
                    }
                });
                input.addEventListener('click', e => e.stopPropagation());
            });

            // Event listeners pour le mode avancé
            container.querySelectorAll('.bme-advanced-toggle input').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const type = e.target.dataset.type;
                    const advancedColors = container.querySelector(`.bme-advanced-colors[data-type="${type}"]`);
                    if (advancedColors) {
                        advancedColors.classList.toggle('open', e.target.checked);
                    }
                });
                checkbox.addEventListener('click', e => e.stopPropagation());
            });

            // Event listeners pour les couleurs avancées
            container.querySelectorAll('.bme-advanced-color-input').forEach(input => {
                input.addEventListener('input', (e) => {
                    const type = e.target.dataset.type;
                    const prop = e.target.dataset.prop;
                    const color = e.target.value.toUpperCase();

                    tempSettings.eventColors[type][prop] = color;

                    // Mettre à jour l'input hex associé
                    const hexInput = container.querySelector(`.bme-advanced-hex[data-type="${type}"][data-prop="${prop}"]`);
                    if (hexInput) hexInput.value = color;

                    // Mettre à jour le color picker principal si c'est la bordure
                    if (prop === 'border') {
                        const mainInput = container.querySelector(`.bme-color-input[data-type="${type}"]`);
                        const mainHex = container.querySelector(`.bme-color-hex[data-type="${type}"]`);
                        if (mainInput) mainInput.value = color;
                        if (mainHex) mainHex.value = color;
                    }

                    // Mettre à jour le dot
                    const dot = container.querySelector(`.bme-color-item[data-type="${type}"] .bme-color-dot`);
                    if (dot) {
                        dot.style.backgroundColor = tempSettings.eventColors[type].normal;
                        dot.style.borderColor = tempSettings.eventColors[type].border;
                    }

                    // Calculer la couleur du chip
                    if (prop === 'border') {
                        const hex = color.replace('#', '');
                        const r = parseInt(hex.substr(0, 2), 16) / 255;
                        const g = parseInt(hex.substr(2, 2), 16) / 255;
                        const b = parseInt(hex.substr(4, 2), 16) / 255;
                        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                        tempSettings.eventColors[type].chipColor = luminance > 0.5 ? '#000000' : '#FFFFFF';
                    }

                    updatePreview();
                });
                input.addEventListener('click', e => e.stopPropagation());
            });

            container.querySelectorAll('.bme-advanced-hex').forEach(input => {
                input.addEventListener('input', (e) => {
                    let value = e.target.value.trim();
                    if (!value.startsWith('#')) value = '#' + value;
                    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                        const colorInput = container.querySelector(`.bme-advanced-color-input[data-type="${e.target.dataset.type}"][data-prop="${e.target.dataset.prop}"]`);
                        if (colorInput) {
                            colorInput.value = value;
                            colorInput.dispatchEvent(new Event('input'));
                        }
                    }
                });
                input.addEventListener('click', e => e.stopPropagation());
            });

            // Sélectionner le premier par défaut
            updatePreview();
        }

        // Ouvrir/fermer le popup
        function openSettings() {
            tempSettings = JSON.parse(JSON.stringify(bmeSettings));
            // S'assurer que eventColors existe et contient tous les types (fusion avec défauts)
            if (!tempSettings.eventColors) {
                tempSettings.eventColors = JSON.parse(JSON.stringify(BME_DEFAULT_EVENT_COLORS));
            } else {
                // Fusionner avec les couleurs par défaut pour inclure les nouveaux types (ex: EXAM)
                for (const [key, value] of Object.entries(BME_DEFAULT_EVENT_COLORS)) {
                    if (!tempSettings.eventColors[key]) {
                        tempSettings.eventColors[key] = JSON.parse(JSON.stringify(value));
                    }
                }
            }
            if (tempSettings.showProfilePicture === undefined) {
                tempSettings.showProfilePicture = true;
            }
            // Mettre à jour le toggle
            toggleProfilePic.classList.toggle('active', tempSettings.showProfilePicture);
            showPage('main');
            overlay.classList.add('open');
            setTimeout(updateSliderUI, 50);
        }

        function closeSettings() {
            overlay.classList.remove('open');
        }

        // Sauvegarder et fermer
        function saveAndClose() {
            bmeSettings = JSON.parse(JSON.stringify(tempSettings));
            saveSettings(bmeSettings);
            applyEventColors();
            applyProfilePictureSetting();
            closeSettings();
            // Forcer le re-render du planning immédiatement
            const timeContent = document.querySelector('.rbc-time-content');
            if (timeContent) {
                timeContent.removeAttribute('data-bme-cropped');
                timeContent.removeAttribute('data-bme-crop-period');
                w.dispatchEvent(new CustomEvent('bme-settings-update', { detail: bmeSettings }));
            }
        }

        // Appliquer les couleurs des événements
        function applyEventColors() {
            let dynamicCssId = 'bme-dynamic-event-colors';
            let existingStyle = document.getElementById(dynamicCssId);
            if (existingStyle) existingStyle.remove();

            const colors = bmeSettings.eventColors || BME_DEFAULT_EVENT_COLORS;
            let css = '';

            for (const [key, c] of Object.entries(colors)) {
                const safeKey = key.replace(/\./g, '\\.');
                css += `.course.course-${safeKey}:not(.chip-color) { background-color: ${c.normal} !important; }`;
                css += `.course.course-${safeKey}:not(.chip-color):hover { background-color: ${c.hover} !important; }`;
                css += `.course.course-${safeKey}:not(.chip-color):active { background-color: ${c.active} !important; }`;
                css += `.course.course-${safeKey}.event-border { border-color: ${c.border} !important; }`;
                css += `.course.course-${safeKey}.chip-color { background-color: ${c.border} !important; color: ${c.chipColor}; }`;
            }

            // Ajouter les alias (types de cours alternatifs qui partagent les mêmes couleurs)
            const aliases = { CTD: 'TD', TD20: 'TD', CTP: 'TP', 'COURS.LANGUE': 'CLG', 'COURS.COMM': 'COMM', CE: 'EXAM', DE: 'EXAM'};
            for (const [alias, original] of Object.entries(aliases)) {
                const c = colors[original];
                if (c) {
                    const safeAlias = alias.replace(/\./g, '\\.');
                    css += `.course.course-${safeAlias}:not(.chip-color) { background-color: ${c.normal} !important; }`;
                    css += `.course.course-${safeAlias}:not(.chip-color):hover { background-color: ${c.hover} !important; }`;
                    css += `.course.course-${safeAlias}:not(.chip-color):active { background-color: ${c.active} !important; }`;
                    css += `.course.course-${safeAlias}.event-border { border-color: ${c.border} !important; }`;
                    css += `.course.course-${safeAlias}.chip-color { background-color: ${c.border} !important; color: ${c.chipColor}; }`;
                }
            }

            const style = document.createElement('style');
            style.id = dynamicCssId;
            style.textContent = css;
            document.head.appendChild(style);
        }

        // Appliquer le paramètre de photo de profil
        // Easter egg: 1% de chance d'avoir Rick Astley en photo de profil
        const BME_RICKROLL_URL = 'data:image/png;base64,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';
        const bmeIsRickRolled = Math.random() < 0.01; // 1 chance sur 100

        function applyProfilePictureSetting() {
            let cssId = 'bme-profile-pic-css';
            let existingStyle = document.getElementById(cssId);
            if (existingStyle) existingStyle.remove();

            // Easter egg Rick Roll (1% de chance)
            if (bmeIsRickRolled && bmeSettings.showProfilePicture) {
                const style = document.createElement('style');
                style.id = cssId;
                style.textContent = `
                    .MuiAvatar-root.MuiAvatar-circular {
                        position: relative;
                        overflow: hidden;
                    }
                    .MuiAvatar-root.MuiAvatar-circular img,
                    .MuiAvatar-root.MuiAvatar-circular .MuiAvatar-img {
                        display: none !important;
                        visibility: hidden !important;
                    }
                    .MuiAvatar-root.MuiAvatar-circular::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background-image: url("${BME_RICKROLL_URL}");
                        background-size: cover;
                        background-position: center;
                    }
                `;
                document.head.appendChild(style);
                console.log('🎵 Never gonna give you up, never gonna let you down... 🎵');
                return;
            }

            if (!bmeSettings.showProfilePicture) {
                const style = document.createElement('style');
                style.id = cssId;
                // Remplacer la photo par une icône de profil par défaut
                style.textContent = `
                    .MuiAvatar-root.MuiAvatar-circular {
                        background-image: none !important;
                        background-color: #e5e7eb !important;
                        position: relative;
                    }
                    .MuiAvatar-root.MuiAvatar-circular img,
                    .MuiAvatar-root.MuiAvatar-circular .MuiAvatar-img {
                        display: none !important;
                        visibility: hidden !important;
                    }
                    .MuiAvatar-root.MuiAvatar-circular::before {
                        content: '' !important;
                        display: none !important;
                    }
                    .MuiAvatar-root.MuiAvatar-circular::after {
                        content: '';
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 60%;
                        height: 60%;
                        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239ca3af'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E");
                        background-size: contain;
                        background-repeat: no-repeat;
                        background-position: center;
                    }
                `;
                document.head.appendChild(style);
            }
        }

        // Appliquer les paramètres au chargement
        applyEventColors();
        applyProfilePictureSetting();

        // Exposer openSettings globalement pour le bouton du menu profil
        w.bmeOpenSettings = openSettings;

        overlay.querySelector('.bme-settings-close').addEventListener('click', saveAndClose);
        // Clic sur l'overlay (en dehors de la popup) - sauvegarder et fermer
        // Mais ignorer si on est en train de drag (mouseup après drag)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && !isDragging) {
                saveAndClose();
            }
        });
        // Empêcher la fermeture lors d'un mouseup après drag en dehors de la popup
        overlay.addEventListener('mouseup', (e) => {
            // Le isDragging sera remis à false par handleDragEnd, qui est appelé avant ce listener
            // Donc on ne fait rien ici, c'est géré par le flag isDragging
        });

        // Bouton reset (page principale)
        document.getElementById('bme-btn-reset').addEventListener('click', () => {
            tempSettings = JSON.parse(JSON.stringify(BME_DEFAULT_SETTINGS));
            toggleProfilePic.classList.toggle('active', tempSettings.showProfilePicture);
            updateSliderUI();
        });

        // Bouton sauvegarder (page principale)
        document.getElementById('bme-btn-save').addEventListener('click', saveAndClose);

        // Bouton appliquer (page thème)
        document.getElementById('bme-btn-save-theme').addEventListener('click', () => {
            showPage('main');
        });

        // Initialiser les interactions de la prévisualisation
        setupPreviewInteractions();

        // Mettre à jour le slider après ouverture (pour calculer les dimensions)
        setTimeout(updateSliderUI, 100);
    }

    // Créer le menu de settings au chargement
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createSettingsMenu);
    } else {
        createSettingsMenu();
    }

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

    // === Better MyEfrei — Navigation améliorée ===
    // Inverse le bouton "Aujourd'hui" et l'indicateur de semaine pour une meilleure UX
    const NAV_CSS_ID = 'bme-nav-css';
    if (!document.querySelector(`#${NAV_CSS_ID}`)) {
        const navCss = document.createElement('style');
        navCss.id = NAV_CSS_ID;
        navCss.textContent = `
    /* Groupe de navigation unifié (flèches + aujourd'hui) */
    .bme-nav-group {
        display: inline-flex;
        align-items: stretch;
    }

    /* Boutons dans le groupe - garder le style MUI existant mais ajuster les bordures */
    .bme-nav-group > button:first-child {
        border-top-right-radius: 0 !important;
        border-bottom-right-radius: 0 !important;
        border-right: none !important;
    }

    .bme-nav-group > button:last-child {
        border-top-left-radius: 0 !important;
        border-bottom-left-radius: 0 !important;
        border-left: none !important;
    }

    .bme-nav-group > button.bme-today-btn {
        border-radius: 0 !important;
        border-left: none !important;
        border-right: none !important;
        position: relative;
        overflow: hidden;
    }

    /* Style hover pour les boutons flèches dans le groupe */
    .bme-nav-group > button.MuiIconButton-root {
        border: 1px solid #1565c0 !important;
        border-radius: 0 !important;
        padding: 4px 8px !important;
        position: relative;
        overflow: hidden;
    }

    .bme-nav-group > button.MuiIconButton-root:first-child {
        border-top-left-radius: 4px !important;
        border-bottom-left-radius: 4px !important;
        border-right: none !important;
    }

    .bme-nav-group > button.MuiIconButton-root:last-child {
        border-top-right-radius: 4px !important;
        border-bottom-right-radius: 4px !important;
        border-left: none !important;
    }

    /* Cacher le ripple MUI par défaut dans le groupe de navigation */
    .bme-nav-group > button .MuiTouchRipple-root {
        display: none !important;
    }

    /* Animation ripple */
    @keyframes bme-ripple-anim {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }

    .bme-ripple {
        position: absolute;
        border-radius: 50%;
        background-color: rgba(21, 101, 192, 0.3);
        transform: scale(0);
        animation: bme-ripple-anim 0.6s ease-out;
        pointer-events: none;
    }
  `;
        document.head.appendChild(navCss);
    }

    // Fonction pour créer l'effet ripple
    function createRipple(event, button) {
        const ripple = document.createElement('span');
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        ripple.className = 'bme-ripple';
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';

        button.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    }

    // Fonction pour réorganiser la navigation du calendrier
    function reorganizeCalendarNavigation() {
        // Trouver le conteneur de la toolbar du calendrier
        const toolbar = document.querySelector('.rbc-calendar > div:first-child');
        if (!toolbar || toolbar.dataset.bmeNavProcessed) return;

        // Trouver les éléments
        const todayButton = toolbar.querySelector('button.MuiButton-outlined');
        const labelDate = toolbar.querySelector('.label-date');
        if (!todayButton || !labelDate) return;

        const leftArrow = labelDate.querySelector('button:first-of-type');
        const rightArrow = labelDate.querySelector('button:last-of-type');
        const weekLabel = labelDate.querySelector('p');
        if (!leftArrow || !rightArrow || !weekLabel) return;

        // Marquer comme traité
        toolbar.dataset.bmeNavProcessed = '1';

        // Créer le groupe de navigation
        const navGroup = document.createElement('div');
        navGroup.className = 'bme-nav-group';

        // Cloner le bouton aujourd'hui pour le mettre au milieu
        const todayBtnClone = todayButton.cloneNode(true);
        todayBtnClone.classList.add('bme-today-btn');

        // Supprimer le span MuiTouchRipple existant pour éviter les conflits
        const existingRipple = todayBtnClone.querySelector('.MuiTouchRipple-root');
        if (existingRipple) existingRipple.remove();

        // Supprimer aussi les ripples MUI des flèches
        const leftRipple = leftArrow.querySelector('.MuiTouchRipple-root');
        if (leftRipple) leftRipple.remove();
        const rightRipple = rightArrow.querySelector('.MuiTouchRipple-root');
        if (rightRipple) rightRipple.remove();

        // Transférer le clic vers le bouton original avec effet ripple
        todayBtnClone.addEventListener('click', (e) => {
            createRipple(e, todayBtnClone);
            e.preventDefault();
            e.stopPropagation();
            todayButton.click();
        });

        // Ajouter l'effet ripple aux boutons flèches
        leftArrow.addEventListener('click', (e) => createRipple(e, leftArrow));
        rightArrow.addEventListener('click', (e) => createRipple(e, rightArrow));

        // Déplacer les flèches et le bouton aujourd'hui dans le groupe
        navGroup.appendChild(leftArrow);
        navGroup.appendChild(todayBtnClone);
        navGroup.appendChild(rightArrow);

        // Cacher le bouton aujourd'hui original
        todayButton.style.display = 'none';

        // Remplacer le contenu de label-date par le groupe de navigation
        labelDate.innerHTML = '';
        labelDate.appendChild(navGroup);

        // Déplacer l'indicateur de semaine à gauche (à la place du bouton aujourd'hui)
        toolbar.insertBefore(weekLabel, todayButton);
    }

    // Observer pour détecter quand le calendrier est chargé et réappliquer si nécessaire
    const navObserver = new MutationObserver(() => {
        reorganizeCalendarNavigation();
    });
    navObserver.observe(document.body, { childList: true, subtree: true });

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
        CLG: {
            normal: '#E2EFFF',
            hover: '#CCE2FF',
            active: '#92C1FB',
            border: '#0163DD',
            chipColor: '#FFFFFF'
        },
        COMM: {
            normal: '#E2EFFF',
            hover: '#CCE2FF',
            active: '#92C1FB',
            border: '#0163DD',
            chipColor: '#FFFFFF'
        },
        EXAM: {
            normal: '#FFE8F1',
            hover: '#FFD4E5',
            active: '#FFB0CC',
            border: '#FF7EB8',
            chipColor: '#FFFFFF'
        }
    };
    // Alias pour les types de cours alternatifs
    CALENDAR_EVENT_COLORS.CTD = CALENDAR_EVENT_COLORS.TD;
    CALENDAR_EVENT_COLORS.TD20 = CALENDAR_EVENT_COLORS.TD;
    CALENDAR_EVENT_COLORS.CTP = CALENDAR_EVENT_COLORS.TP;
    CALENDAR_EVENT_COLORS['COURS.LANGUE'] = CALENDAR_EVENT_COLORS.CLG;
    CALENDAR_EVENT_COLORS['COURS.COMM'] = CALENDAR_EVENT_COLORS.COMM;
    CALENDAR_EVENT_COLORS.CE = CALENDAR_EVENT_COLORS.EXAM;
    CALENDAR_EVENT_COLORS.DE = CALENDAR_EVENT_COLORS.EXAM;
    // Note: Les couleurs CSS sont maintenant générées dynamiquement par applyEventColors() dans le menu settings
    // pour permettre la personnalisation des couleurs par l'utilisateur
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
        ['CLG', 'CLG (Cours de langue)'],
        ['COMM', 'COMM (Cours de communication)'],
        ['EXAM', 'EXAM (Examen)'],
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

        // 2) Ajouter nos types de cours (couleur = border de settings ou CALENDAR_EVENT_COLORS par défaut)
        const customColors = bmeSettings.eventColors || {};
        COURSE_TYPES.forEach(([key, label]) => {
            const color = customColors[key]?.border || CALENDAR_EVENT_COLORS?.[key]?.border || '#0163DD';
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
        // Affiche uniquement les heures configurées, sans scroll
        // Les valeurs sont maintenant personnalisables via le menu de settings

        /**
         * Récupère la configuration de planning depuis les settings
         * Convertit le format décimal (7.5 = 7h30) en format { hour, minutes }
         */
        function getPlanningConfig() {
            const startDecimal = bmeSettings.planning.startTime;
            const endDecimal = bmeSettings.planning.endTime;
            return {
                START_HOUR: Math.floor(startDecimal),
                END_HOUR: Math.floor(endDecimal),
                OFFSET_START: Math.round((startDecimal - Math.floor(startDecimal)) * 60),
                OFFSET_END: Math.round((endDecimal - Math.floor(endDecimal)) * 60)
            };
        }

        /**
         * Crop le planning pour n'afficher que les heures configurées
         * et supprime le scroll pour une vue complète sans défilement.
         */
        function cropPlanningToVisibleHours() {
            const timeContent = document.querySelector('.rbc-time-content');
            if (!timeContent) return;

            // Récupérer la configuration dynamique depuis les settings
            const config = getPlanningConfig();

            // Clé de période incluant les settings pour forcer le refresh si changement
            const settingsKey = `${bmeSettings.planning.startTime}-${bmeSettings.planning.endTime}`;
            const periodKey = (document.querySelector('.label-date p')?.textContent?.trim()
                || document.querySelector('.rbc-time-header-content')?.textContent?.trim()
                || 'unknown-period') + '-' + settingsKey;

            // Si déjà traité pour cette période avec ces settings, on ne refait pas
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
                    if (hour === config.START_HOUR) startGroup = group;
                    if (hour === config.END_HOUR) endGroup = group;
                }
            }

            if (!startGroup || !endGroup) return;

            // Calcul de la hauteur par heure (basé sur le premier groupe trouvé)
            const groupHeight = startGroup.offsetHeight;
            const pxPerMinute = groupHeight / 60;

            // Calculer les offsets de début et fin
            let startOffset = startGroup.offsetTop + (config.OFFSET_START * pxPerMinute);
            let endOffset = endGroup.offsetTop + (config.OFFSET_END * pxPerMinute);

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

        // Écouter les changements de settings pour mettre à jour le planning immédiatement
        w.addEventListener('bme-settings-update', () => {
            const timeContent = document.querySelector('.rbc-time-content');
            if (timeContent) {
                timeContent.removeAttribute('data-bme-cropped');
                timeContent.removeAttribute('data-bme-crop-period');
                cropPlanningToVisibleHours();
            }
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
            // Ouvrir la popup de settings Better MyEfrei
            if (typeof w.bmeOpenSettings === 'function') {
                w.bmeOpenSettings();
            }
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
        // Alias pour normaliser les types
        const aliases = { CTD: 'TD', TD20: 'TD', CTP: 'TP', 'COURS.LANGUE': 'CLG', 'COURS.COMM': 'COMM', CE: 'EXAM', DE: 'EXAM' };
        const normalizedType = aliases[t] || t;
        // Priorité aux couleurs personnalisées, sinon couleurs par défaut
        const userColors = bmeSettings?.eventColors?.[normalizedType];
        const defaultColors = CALENDAR_EVENT_COLORS[normalizedType] || CALENDAR_EVENT_COLORS[t];
        return userColors?.border || defaultColors?.border || fallback;
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
        // Note: certains codes se terminent par SCM, STP - on cherche les types connus
        const knownTypes = ['CTD', 'TD20', 'CTP', 'CM', 'TD', 'TP', 'PRJ', 'TPA', 'IE', 'CLG', 'COMM', 'EXAM', 'CE', 'DE'];
        let typeFromCode = '';
        // Chercher dans la description entre parenthèses
        const descMatch = codeModuleRaw.match(/\(([^)]+)\)/);
        if (descMatch) {
            const desc = descMatch[1].toUpperCase();
            if (desc.includes('COURS MAGISTRAL') || desc.includes('MAGISTRAL')) typeFromCode = 'CM';
            else if (desc.includes('TRAVAUX DIRIGÉS') || desc.includes('TRAVAUX DIRIGES') || desc.includes('TD')) typeFromCode = 'TD';
            else if (desc.includes('TRAVAUX PRATIQUES') || desc.includes('TP')) typeFromCode = 'TP';
            else if (desc.includes('PROJET')) typeFromCode = 'PRJ';
            else if (desc.includes('ÉVALUATION') || desc.includes('EVALUATION') || desc.includes('CONTRÔLE') || desc.includes('CONTROLE')) typeFromCode = 'IE';
            else if (desc.includes('EXAMEN') || desc.includes('EXAM')) typeFromCode = 'EXAM';
        }
        // Sinon chercher le type connu à la fin du code module
        if (!typeFromCode) {
            for (const t of knownTypes) {
                if (new RegExp(`${t}(?:\\s*\\(|$)`, 'i').test(codeModuleRaw)) {
                    typeFromCode = t;
                    break;
                }
            }
        }
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

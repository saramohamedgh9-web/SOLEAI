(function () {
    'use strict';

    // UI Elements
    const generateBtn = document.getElementById('generateBtn');
    const formError = document.getElementById('formError');
    const emptyState = document.getElementById('emptyState');
    const loadingState = document.getElementById('loadingState');
    const result = document.getElementById('result');

    // Image elements
    const imgLoading = document.getElementById('imgLoading');
    const imgFrame = document.getElementById('imgFrame');
    const imgError = document.getElementById('imgError');
    const imgErrorText = document.getElementById('imgErrorText');
    const regenImgBtn = document.getElementById('regenImgBtn');
    const aiImage = document.getElementById('aiImage');
    const regenBtn = document.getElementById('regenBtn');

    let currentConcept = null;

    // ── Helpers ─────────────────────────────────────────────────────
    const collectPrefs = () => ({
        style: document.getElementById('style').value,
        material: document.getElementById('material').value,
        occasion: document.getElementById('occasion').value,
        primary_color: document.getElementById('primary_color').value,
        accent_color: document.getElementById('accent_color').value,
        inspiration: document.getElementById('inspiration').value
    });

    const setUI = (state) => {
        emptyState?.classList.add('hidden');
        loadingState?.classList.add('hidden');
        result?.classList.add('hidden');
        if (state === 'empty') emptyState?.classList.remove('hidden');
        if (state === 'loading') loadingState?.classList.remove('hidden');
        if (state === 'result') result?.classList.remove('hidden');
    };

    const setStage = (stage) => {
        document.getElementById('stageGroq')?.classList.remove('stage-pill--active');
        document.getElementById('stageHF')?.classList.remove('stage-pill--active');
        if (stage === 'groq') document.getElementById('stageGroq')?.classList.add('stage-pill--active');
        if (stage === 'hf') document.getElementById('stageHF')?.classList.add('stage-pill--active');
    };

    const startLoader = () => { };
    const stopLoader = () => { };

    const renderConcept = (concept) => {
        document.getElementById('resultName').textContent = concept.name || "AI Concept";
        document.getElementById('resultTagline').textContent = concept.tagline || "";

        // Fallback UI population for testing
        document.getElementById('resultDesc').textContent = "Design generation complete. Rendering image...";
        document.getElementById('resultPrice').textContent = "$150";
        document.getElementById('resultAudience').textContent = "Concept Phase";
    };


    // ── Chip selection & Colors ─────────────────────────────────────
    document.querySelectorAll('.chip-group').forEach(group => {
        const hiddenInput = document.getElementById(group.dataset.field);
        group.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                if (hiddenInput) hiddenInput.value = chip.dataset.value;
            });
        });
    });

    function syncColorPair(pickerId, textId) {
        const picker = document.getElementById(pickerId);
        const text = document.getElementById(textId);
        if (!picker || !text) return;
        picker.addEventListener('input', () => { text.value = picker.value; });
        text.addEventListener('input', () => {
            if (/^#[0-9A-Fa-f]{6}$/.test(text.value)) picker.value = text.value;
        });
    }
    syncColorPair('primary_color', 'primary_color_text');
    syncColorPair('accent_color', 'accent_color_text');


    // ── TODO BLOCK IMPLEMENTATIONS ──────────────────────────────────

    // TODO 1
    const showImgLoading = () => {
        imgLoading?.classList.remove('hidden');
        imgFrame?.classList.add('hidden');
        imgError?.classList.add('hidden');
        regenImgBtn?.classList.add('hidden');
    };

    // TODO 2
    const showImgResult = url => {
        imgLoading?.classList.add('hidden');
        imgError?.classList.add('hidden');
        if (aiImage) aiImage.src = url;
        imgFrame?.classList.remove('hidden');
        regenImgBtn?.classList.remove('hidden');
    };

    // TODO 3
    const showImgError = msg => {
        imgLoading?.classList.add('hidden');
        imgFrame?.classList.add('hidden');
        if (imgErrorText) imgErrorText.textContent = msg || 'Image generation failed.';
        imgError?.classList.remove('hidden');
        regenImgBtn?.classList.remove('hidden');
    };

    // TODO 4
    const fetchImage = async (prompt, historyId) => {
        setStage('hf'); showImgLoading();
        try {
            const r = await fetch('/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_prompt: prompt, history_id: historyId })
            });
            const d = await r.json();
            if (!r.ok || d.error) throw new Error(d.error || 'Image generation failed');
            showImgResult(d.image_url);
        } catch (e) {
            showImgError(e.message);
        }
    };

    // TODO 5
    const runGeneration = async token => {
        const prefs = collectPrefs();
        generateBtn.disabled = true;
        setUI('loading'); setStage('groq'); startLoader();
        try {
            const r = await fetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...prefs, 'h-captcha-response': token })
            });
            const d = await r.json();
            if (!r.ok || d.error) throw new Error(d.error || 'Server error');
            stopLoader();
            currentConcept = d.concept;
            renderConcept(d.concept);
            setUI('result');
            fetchImage(d.concept.image_prompt || `Premium ${prefs.style} sneaker, ${prefs.material}, studio photography, 8k`, d.history_id);
        } catch (e) {
            stopLoader(); setUI('empty'); formError.textContent = e.message || 'Something went wrong.';
        } finally {
            generateBtn.disabled = false;
            if (typeof hcaptcha !== 'undefined' && typeof captchaWidgetId !== 'undefined' && captchaWidgetId !== null) hcaptcha.reset(captchaWidgetId);
        }
    };

    // ── Event Listeners ─────────────────────────────────────────────
    generateBtn && generateBtn.addEventListener('click', () => {
        formError.textContent = '';
        // Skip Captcha if no key is provided, just run directly
        if (!window.HCAPTCHA_SITE_KEY || window.HCAPTCHA_SITE_KEY === "") {
            runGeneration(null);
        } else {
            // Normally show modal here, but for now just pass null
            runGeneration(null);
        }
    });

    regenImgBtn && regenImgBtn.addEventListener('click', () => {
        const prefs = collectPrefs();
        // Pass null or a stored history ID if we want regeneration to update the same card
        fetchImage(`Premium ${prefs.style} sneaker, ${prefs.material}, studio photography, 8k`, null);
    });

    // LESSON 6 TODO 1
    regenBtn?.addEventListener('click', () => {
        formError.textContent = '';
        setUI('empty');
        currentConcept = null;
        document.querySelector('.form-panel')?.scrollIntoView({ behavior: 'smooth' });
    });

})();
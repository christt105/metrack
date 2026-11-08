/** The styles the collage page carries in the theme. */
export const COLLAGE_CSS = String.raw`    .collage-wrapper {
        display: flex;
        flex-direction: row;
        gap: 20px;
        padding: 16px;
        max-width: 100%;
        margin: 70px auto 0;
        height: calc(100vh - 90px);
        box-sizing: border-box;
        position: relative;
    }

    .collage-controls-toggle {
        display: none;
    }

    .collage-controls {
        flex: 0 0 280px;
        background: rgb(50, 50, 50);
        padding: 20px;
        border-radius: 12px;
        overflow-y: auto;
        max-height: 100%;
    }

    .collage-controls h2 {
        margin: 0 0 16px;
        font-size: 1.1rem;
    }

    .control-group {
        margin-bottom: 18px;
    }

    .control-group label {
        display: block;
        font-weight: bold;
        margin-bottom: 6px;
        font-size: 0.9rem;
    }

    .checkbox-wrapper label {
        display: block;
        font-weight: normal;
        margin-bottom: 5px;
        cursor: pointer;
        font-size: 0.9rem;
    }

    input[type="date"],
    input[type="range"] {
        width: 100%;
        padding: 6px 8px;
        border-radius: 6px;
        border: 1px solid rgba(128,128,128,0.4);
        box-sizing: border-box;
        background: rgba(0,0,0,0.3);
        color: inherit;
    }

    .control-stats {
        font-size: 0.85rem;
        margin-bottom: 16px;
        opacity: 0.75;
    }

    .btn-download {
        width: 100%;
        padding: 12px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        cursor: pointer;
        transition: opacity 0.2s;
    }

    .btn-download:hover {
        opacity: 0.85;
    }

    .collage-preview-area {
        flex: 1;
        background: #2a2a2a;
        padding: 16px;
        border-radius: 12px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        min-height: 200px;
    }

    .canvas-scaler {
        transform-origin: center center;
        transition: transform 0.3s ease;
    }

    #collage-canvas {
        background: black;
        display: grid;
        gap: 0;
        width: fit-content;
        box-shadow: 0 0 50px rgba(0, 0, 0, 0.8);
    }

    .collage-item {
        width: 600px;
        aspect-ratio: 2/3;
        overflow: hidden;
        position: relative;
    }

    .collage-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    /* Mobile layout */
    @media (max-width: 768px) {
        .collage-wrapper {
            flex-direction: column;
            height: auto;
            margin-top: 60px;
            padding: 10px;
            gap: 10px;
        }

        .collage-controls-toggle {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            background: rgb(50, 50, 50);
            border: none;
            border-radius: 8px;
            color: inherit;
            font-size: 0.95rem;
            cursor: pointer;
            width: 100%;
            justify-content: center;
        }

        .collage-controls {
            flex: none;
            max-height: none;
            transition: max-height 0.3s ease, padding 0.3s ease, opacity 0.3s ease;
            overflow: hidden;
        }

        .collage-controls.is-collapsed {
            max-height: 0 !important;
            padding-top: 0;
            padding-bottom: 0;
            opacity: 0;
        }

        .collage-preview-area {
            height: auto;
            min-height: 120px;
            align-items: flex-start;
        }
    }
`;

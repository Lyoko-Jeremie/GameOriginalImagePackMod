import JSZip from "jszip";
import type {LifeTimeCircleHook, LogWrapper} from "../../../dist-BeforeSC2/ModLoadController";
import type {SC2DataManager} from "../../../dist-BeforeSC2/SC2DataManager";
import type {ModUtils} from "../../../dist-BeforeSC2/Utils";
import type {ModBootJson, ModImg, ModInfo} from "../../../dist-BeforeSC2/ModLoader";
import {isArray, isNil, isString} from 'lodash';


export class GameOriginalImagePack {
    private logger: LogWrapper;

    constructor(
        public gSC2DataManager: SC2DataManager,
        public gModUtils: ModUtils,
    ) {
        this.logger = gModUtils.getLogger();
    }

    async imgLoaderHooker(
        src: string,
        layer: any,
        successCallback: (src: string, layer: any, img: HTMLImageElement) => void,
        errorCallback: (src: string, layer: any, event: any) => void,
    ) {
        const n = this.selfImg.get(src);
        if (n) {
            try {
                // this may throw error
                const imgString = await n.getter.getBase64Image();

                const image = new Image();
                image.onload = () => {
                    successCallback(src, layer, image);
                };
                image.onerror = (event) => {
                    console.error('[GameOriginalImagePack] loadImage replace error', [src]);
                    this.logger.error(`[GameOriginalImagePack] loadImage replace error: src[${src}]`);
                    errorCallback(src, layer, event);
                };
                image.src = imgString;
                // console.log('[GameOriginalImagePack] loadImage replace', [n.modName, src, image, n.imgData]);
                return true;
            } catch (e) {
                console.error('[GameOriginalImagePack] loadImage replace error', [src, e]);
                this.logger.error(`[GameOriginalImagePack] loadImage replace error: src[${src}] e[${e}]`);
                return false;
            }
        } else {
            console.warn('[GameOriginalImagePack] cannot find img. this mod is loaded as the latest ?', [src]);
            this.logger.warn(`[GameOriginalImagePack] cannot find img. this mod is loaded as the latest ?: src[${src}]`);
            return false;
        }
    }

    init() {
        if (window.modImgLoaderHooker) {
            window.modImgLoaderHooker.addSideHooker(this.imgLoaderHooker.bind(this));
        } else {
            console.error('[GameOriginalImagePack] window.modImgLoaderHooker not found');
            this.logger.error('[GameOriginalImagePack] window.modImgLoaderHooker not found');
            return;
        }
        // init self
        const mod = this.gModUtils.getMod('GameOriginalImagePack');
        if (!mod) {
            console.error('[GameOriginalImagePack] self mod not found');
            this.logger.error('[GameOriginalImagePack] self mod not found');
            return;
        }
        if (!isArray(mod.imgs)) {
            console.error('[GameOriginalImagePack] self mod.imgs invalid');
            this.logger.error('[GameOriginalImagePack] self mod.imgs invalid');
            return;
        }
        for (const img of mod.imgs) {
            this.selfImg.set(img.path, img);
        }
    }

    selfImg: Map<string, ModImg> = new Map<string, ModImg>();
}

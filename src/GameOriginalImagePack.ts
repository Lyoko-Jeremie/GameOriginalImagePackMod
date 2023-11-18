import JSZip from "jszip";
import type {LifeTimeCircleHook, LogWrapper} from "../../../dist-BeforeSC2/ModLoadController";
import type {SC2DataManager} from "../../../dist-BeforeSC2/SC2DataManager";
import type {ModUtils} from "../../../dist-BeforeSC2/Utils";
import type {ModBootJson, ModImg, ModInfo} from "../../../dist-BeforeSC2/ModLoader";
import {isArray, isNil, isString} from 'lodash';
import {LRUCache} from 'lru-cache';

export const GameOriginalImagePackLruCache = new LRUCache<string, string>({
    max: 30,
    ttl: 1000 * 60 * 30,
    dispose: (value: string, key: string, reason: LRUCache.DisposeReason) => {
        console.log('GameOriginalImagePackLruCache dispose', [value], [reason]);
    },
    updateAgeOnGet: true,
    updateAgeOnHas: true,
});

export class GameOriginalImagePack implements LifeTimeCircleHook {
    private logger: LogWrapper;

    constructor(
        public gSC2DataManager: SC2DataManager,
        public gModUtils: ModUtils,
    ) {
        this.logger = gModUtils.getLogger();
        this.gSC2DataManager.getSc2EventTracer().addCallback({
            whenSC2PassageEnd: this.findAllInputImageAndReplaceSrc.bind(this),
        });
        this.gSC2DataManager.getModLoadController().addLifeTimeCircleHook('GameOriginalImagePack', this);
    }

    async findAllInputImageAndReplaceSrc() {
        console.log('[GameOriginalImagePack] findAllInputImageAndReplaceSrc');
        const nodeList: NodeListOf<HTMLInputElement> = this.gModUtils.getThisWindow().document.querySelectorAll('input[type="image"]');
        console.log('[GameOriginalImagePack] findAllInputImageAndReplaceSrc nodeList', [nodeList]);

        const nodes: HTMLInputElement[] = Array.from(nodeList).filter(T => !!T.src && !T.src.startsWith('data:'));
        console.log('[GameOriginalImagePack] findAllInputImageAndReplaceSrc nodes', [nodes]);

        // redirect to ML.HtmlTagSrcHook
        return Promise.all(nodes.map(async (T) => {
            const src = T.src;
            console.log('[GameOriginalImagePack] findAllInputImageAndReplaceSrc replace', [T, src]);
            const imgString = await this.gSC2DataManager.getHtmlTagSrcHook().requestImageBySrc(src);
            if (imgString) {
                T.src = imgString;
                console.log('[GameOriginalImagePack] findAllInputImageAndReplaceSrc replace ok', [T, src, imgString]);
                return;
            }
            // ignore , leave it origin
            return;

            // const src = T.src;
            // console.log('[GameOriginalImagePack] findAllInputImageAndReplaceSrc replace', [T, src]);
            // const n = this.selfImg.get(src);
            // if (n) {
            //     try {
            //         // this may throw error
            //         const imgString = await n.getter.getBase64Image(GameOriginalImagePackLruCache);
            //         T.src = imgString;
            //         console.log('[GameOriginalImagePack] findAllInputImageAndReplaceSrc replace ok', [T, src, imgString]);
            //     } catch (e) {
            //         console.error('[GameOriginalImagePack] findAllInputImageAndReplaceSrc replace error', [T, src, e]);
            //         this.logger.error(`[GameOriginalImagePack] findAllInputImageAndReplaceSrc replace error: src[${src}] e[${e}]`);
            //     }
            // }
        }));
    }

    async imgLoaderHooker(
        src: string,
        layer: any,
        successCallback: (src: string, layer: any, img: HTMLImageElement) => void,
        errorCallback: (src: string, layer: any, event: any) => void,
    ) {
        const n = this.selfImg.get(src);
        // console.log('[GameOriginalImagePack] imgLoaderHooker', [src, n]);
        if (n) {
            try {
                // this may throw error
                const imgString = await n.getter.getBase64Image(GameOriginalImagePackLruCache);

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
            } catch (e: Error | any) {
                console.error('[GameOriginalImagePack] loadImage replace error', [src, e]);
                this.logger.error(`[GameOriginalImagePack] loadImage replace error: src[${src}] e[${e?.message ? e.message : e}]`);
                return false;
            }
        } else {
            console.warn('[GameOriginalImagePack] cannot find img. this mod is loaded as the latest ?', [src]);
            this.logger.warn(`[GameOriginalImagePack] cannot find img. this mod is loaded as the latest ?: src[${src}]`);
            return false;
        }
    }

    async imageGetter(
        src: string,
    ) {
        const n = this.selfImg.get(src);
        if (n) {
            try {
                // this may throw error
                return await n.getter.getBase64Image(GameOriginalImagePackLruCache);
            } catch (e: Error | any) {
                console.error('[GameOriginalImagePack] imageGetter error', [src, e]);
                this.logger.error(`[GameOriginalImagePack] imageGetter error: src[${src}] e[${e?.message ? e.message : e}]`);
                return undefined;
            }
            return undefined;
        } else {
            console.warn('[GameOriginalImagePack] imageGetter cannot find img. this mod is loaded as the latest ?', [src]);
            this.logger.warn(`[GameOriginalImagePack] imageGetter cannot find img. this mod is loaded as the latest ?: src[${src}]`);
            return undefined;
        }
    }

    async ModLoaderLoadEnd() {
        if (window.modImgLoaderHooker) {
            window.modImgLoaderHooker.addSideHooker({
                hookName: 'GameOriginalImagePackImageSideHook',
                imageLoader: this.imgLoaderHooker.bind(this),
                imageGetter: this.imageGetter.bind(this),
            });
            console.log('[GameOriginalImagePack] ImgLoaderHooker addSideHooker ok');
            this.logger.log('[GameOriginalImagePack] ImgLoaderHooker addSideHooker ok');
        } else {
            console.error('[GameOriginalImagePack] window.modImgLoaderHooker not found');
            this.logger.error('[GameOriginalImagePack] window.modImgLoaderHooker not found');
            return;
        }
    }

    init() {
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

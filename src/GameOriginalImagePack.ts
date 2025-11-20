import type {LifeTimeCircleHook, LogWrapper} from "../../../dist-BeforeSC2/ModLoadController";
import type {SC2DataManager} from "../../../dist-BeforeSC2/SC2DataManager";
import type {ModUtils} from "../../../dist-BeforeSC2/Utils";
import type {ModImg} from "../../../dist-BeforeSC2/ModLoader";
import {every, get, isArray, isString} from 'lodash';

// export const GameOriginalImagePackLruCache = new LRUCache<string, ImgLruCacheItemType>({
//     max: 50,
//     ttl: 1000 * 60 * 30,
//     dispose: (value: ImgLruCacheItemType, key: string, reason: LRUCache.DisposeReason) => {
//         // console.log('GameOriginalImagePackLruCache dispose', [value], [reason]);
//     },
//     updateAgeOnGet: true,
//     updateAgeOnHas: true,
// });

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

        const nodes: HTMLInputElement[] = Array.from(nodeList).filter(T => !!T.src && T.src !== 'null' && !T.src.startsWith('data:'));
        console.log('[GameOriginalImagePack] findAllInputImageAndReplaceSrc nodes', [nodes]);

        // redirect to ML.HtmlTagSrcHook
        return Promise.allSettled(nodes.map(async (T) => {
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
        if (this.selfIgnoreImagePath.has(src)) {
            // skip it.
            return false;
        }
        const n = this.selfImg.get(src);
        // console.log('[GameOriginalImagePack] imgLoaderHooker', [src, n]);
        if (n) {
            try {
                // this may throw error
                const imgString = await n.getter.getBase64Image();
                if (!imgString) {
                    console.error('[GameOriginalImagePack] imgLoaderHooker getBase64Image() invalid', [src]);
                    this.logger.error(`[GameOriginalImagePack] imgLoaderHooker getBase64Image() invalid: src[${src}]`);
                    return false;
                }

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
                // console.log('[GameOriginalImagePack] imgLoaderHooker replace', [n.modName, src, image, n.imgData]);
                return true;
            } catch (e: Error | any) {
                console.error('[GameOriginalImagePack] imgLoaderHooker replace error', [src, e]);
                this.logger.error(`[GameOriginalImagePack] imgLoaderHooker replace error: src[${src}] e[${e?.message ? e.message : e}]`);
                return false;
            }
        } else {
            console.warn('[GameOriginalImagePack] imgLoaderHooker cannot find img. this mod is loaded as the latest ?', [src]);
            this.logger.warn(`[GameOriginalImagePack] imgLoaderHooker cannot find img. this mod is loaded as the latest ?: src[${src}]`);
            return false;
        }
    }

    async imageGetter(
        src: string,
    ) {
        if (this.selfIgnoreImagePath.has(src)) {
            // skip it.
            return undefined;
        }
        const n = this.selfImg.get(src);
        if (n) {
            try {
                // this may throw error
                const r = await n.getter.getBase64Image();
                if (!r) {
                    console.error('[GameOriginalImagePack] imageGetter error. invalid image', [src]);
                    return undefined;
                }
                return r;
            } catch (e: Error | any) {
                console.error('[GameOriginalImagePack] imageGetter error', [src, e]);
                this.logger.error(`[GameOriginalImagePack] imageGetter error: src[${src}] e[${e?.message ? e.message : e}]`);
                return undefined;
            }
            return undefined;
        } else {
            if (src.startsWith('data:')) {
                // it was replaced, ignore it
                return undefined;
            }
            console.warn('[GameOriginalImagePack] imageGetter cannot find img. this mod is loaded as the latest ?', [src]);
            this.logger.warn(`[GameOriginalImagePack] imageGetter cannot find img. this mod is loaded as the latest ?: src[${src}]`);
            return undefined;
        }
    }

    checkImageExist(src: string) {
        if (this.selfIgnoreImagePath.has(src)) {
            // skip it.
            return undefined;
        }
        const n = this.selfImg.get(src);
        if (n) {
            try {
                // this may throw error
                const r = n.getter.invalid;
                if (!r) {
                    return true;
                }
                return false;
            } catch (e: Error | any) {
                console.error('[GameOriginalImagePack] checkImageExist error', [src, e]);
                this.logger.error(`[GameOriginalImagePack] checkImageExist error: src[${src}] e[${e?.message ? e.message : e}]`);
                return undefined;
            }
            return false;
        } else {
            console.warn('[GameOriginalImagePack] checkImageExist cannot find img. this mod is loaded as the latest ?', [src]);
            this.logger.warn(`[GameOriginalImagePack] checkImageExist cannot find img. this mod is loaded as the latest ?: src[${src}]`);
            return false;
        }
    }

    async ModLoaderLoadEnd() {
        if (window.modImgLoaderHooker) {
            window.modImgLoaderHooker.addSideHooker({
                hookName: 'GameOriginalImagePackImageSideHook',
                imageLoader: this.imgLoaderHooker.bind(this),
                imageGetter: this.imageGetter.bind(this),
                checkImageExist: this.checkImageExist.bind(this),
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
        const nowMod = this.gModUtils.getNowRunningModName();
        if (!nowMod) {
            // never go there
            console.error('[GameOriginalImagePack] nowMod invalid');
            this.logger.error('[GameOriginalImagePack] nowMod invalid');
            throw new Error('[GameOriginalImagePack] nowMod invalid');
            return;
        }
        // 'GameOriginalImagePack'
        const mod = this.gModUtils.getMod(nowMod);
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
        if (isArray(get(mod.bootJson, 'ignoreImagePath')) && every(get(mod.bootJson, 'ignoreImagePath'), isString)) {
            this.selfIgnoreImagePath = new Set<string>(get(mod.bootJson, 'ignoreImagePath')! as string[]);
        }
    }

    selfImg: Map<string, ModImg> = new Map<string, ModImg>();

    selfIgnoreImagePath: Set<string> = new Set<string>();

}

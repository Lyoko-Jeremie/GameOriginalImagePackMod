(async () => {
    // register mod at there to let this mod be loaded as the latest in `ImgLoaderHooker.addSideHooker`
    window.modGameOriginalImagePack.init();

    // code from GPT-4o
    // hook the window.Image
    (function () {

        // 保存原始的 Image 构造函数类型
        type ImageConstructor = {
            new(width?: number, height?: number): HTMLImageElement;
            prototype: HTMLImageElement;
        };

        const OriginalImage = window.Image as ImageConstructor;

        // 重写 Image 构造函数
        const NewImage: ImageConstructor = function (this: HTMLImageElement, width?: number, height?: number): HTMLImageElement {
            const img = new OriginalImage(width, height);

            // 重写 img 的 src 属性
            Object.defineProperty(img, 'src', {
                set: function (src: string) {
                    window.modUtils.pSC2DataManager.getHtmlTagSrcHook().requestImageBySrc(src).then(imgString => {
                        if (imgString) {
                            // 创建一个新的 Image 对象来处理缓存中的 Base64 数据
                            const cachedImage = new OriginalImage();

                            // 转发图片的 onload 事件
                            cachedImage.onload = function () {
                                // 将缓存的图片数据赋值给原始 img 对象
                                img.src = imgString;
                                img.width = cachedImage.width;
                                img.height = cachedImage.height;

                                // // 手动触发原始 img 对象的 onload 事件
                                // if (typeof img.onload === 'function') {
                                //     img.onload(new Event('load'));
                                // }
                            };

                            // 转发图片的 onerror 事件
                            cachedImage.onerror = function () {
                                // 手动触发原始 img 对象的 onerror 事件
                                if (typeof img.onerror === 'function') {
                                    img.onerror(new Event('error'));
                                }
                            };

                            cachedImage.src = imgString;
                        } else {
                            img.setAttribute('src', src);
                        }
                    }).catch((e) => {
                        console.error('[GameOriginalImagePack] window.Image catch error', [src, e]);
                        if (typeof img.onerror === 'function') {
                            img.onerror(new Event('error'));
                        }
                    });
                },
                get: function () {
                    return img.getAttribute('src') || '';
                }
            });

            return img;
        } as any as ImageConstructor;

        // 保留原始的 Image.prototype 属性
        NewImage.prototype = OriginalImage.prototype;
        window.Image = NewImage;
    })();

})();

import fs, {readFile, writeFile} from 'fs';
import path from 'path';
import process from 'process';
import {promisify} from 'util';
import JSON5 from 'json5';
import console from "console";
import {join} from "lodash";

async function listFilesDFS(dir: string, relativeTo: string) {
    let stack = [dir];
    let filesList = [];

    while (stack.length > 0) {
        const currentPath = stack.pop()!;
        const files = await promisify(fs.readdir)(currentPath);

        for (const file of files) {
            const fullPath = path.join(currentPath, file);
            if ((await promisify(fs.stat)(fullPath)).isDirectory()) {
                stack.push(fullPath);
            } else {
                filesList.push(path.relative(relativeTo, fullPath));
            }
        }
    }

    return filesList;
}

async function traverseFolderWithStack(folderPath: string) {
    const stack = [folderPath];
    const fileList = [];

    while (stack.length > 0) {
        const currentPath = stack.pop()!;
        const files = await promisify(fs.readdir)(currentPath);

        for (const file of files) {
            const filePath = path.join(currentPath, file);
            const stats = await promisify(fs.stat)(filePath);

            if (stats.isDirectory()) {
                // 如果是文件夹，则将其路径压入栈中，以便后续遍历
                stack.push(filePath);
            }

            if (stats.isFile()) {
                fileList.push(filePath);
            }
        }
    }

    return fileList;
}


;(async () => {

    console.log('process.argv.length', process.argv.length);
    console.log('process.argv', process.argv);
    const bootJsonFilePath = process.argv[2];
    const imgDirPath = process.argv[3];
    const gameVersionString = process.argv[4];
    console.log('bootJsonFilePath', bootJsonFilePath);
    console.log('imgDirPath', imgDirPath);
    console.log('gameVersionString', gameVersionString);
    if (!bootJsonFilePath) {
        console.error('no bootJsonFilePath');
        process.exit(1);
        return;
    }
    if (!imgDirPath) {
        console.error('no imgDirPath');
        process.exit(1);
        return;
    }
    if (!gameVersionString) {
        console.error('no gameVersionString');
        process.exit(1);
        return;
    }
    const bootJsonF = await promisify(readFile)(bootJsonFilePath, {encoding: 'utf-8'});

    const bootJson = JSON5.parse(bootJsonF);
    bootJson.dependenceInfo.find((T: any) => T.modName === 'GameVersion')!.version = `=${gameVersionString}`;

    let imgFileList = await listFilesDFS(imgDirPath, imgDirPath);
    console.log('imgFileList', imgFileList);
    imgFileList = imgFileList.map(T => T.replaceAll('\\', '/')).map(T => `img/${T}`);
    console.log('imgFileList', imgFileList);
    imgFileList = imgFileList.filter(T =>
        T.endsWith('.png')
        || T.endsWith('.jpg')
        || T.endsWith('.jpeg')
        || T.endsWith('.svg')
        || T.endsWith('.icon')
    );
    console.log('imgFileList', imgFileList);

    bootJson.imgFileList = imgFileList;

    await promisify(writeFile)(path.join(path.dirname(bootJsonFilePath), 'boot.json'), JSON.stringify(bootJson, undefined, 2), {encoding: 'utf-8'});

    console.log('=== Congratulation! bootJsonFillTool done! Everything is ok. ===');
})().catch(E => {
    console.error(E);
    process.exit(1);
});




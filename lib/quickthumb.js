(function(){

    var qt = {},
        fs = require('fs'),
        path = require('path'),
        mkdirp = require('mkdirp'),
        async = require('async'),
        ei = require('easyimage');

    module.exports = qt;

    qt.test = function(){
        return 'qt.test';
    };

    qt.isImageQuick = function(path){
        return /\.(jpg|png|gif)$/.test(path);
    };

    qt.isImage = function(path){
        // TODO, make this check Magic
        return qt.isImageQuick(path);
    };

    qt.findImages = function(src){
        var all_files = [],
            files = [],
            stat = fs.statSync(src);

        //TODO make this recursive
        if (stat.isFile()){
            all_files.push(src);
        }
        else if (stat.isDirectory()){
            var filenames = fs.readdirSync(src);
            filenames.forEach(function(filename){
                var f = path.join(src, filename),
                    stat = fs.statSync(f);
                if (stat.isFile()){
                    all_files.push(f);
                }
            });
        }
        all_files.forEach(function(file){
            if (qt.isImage(file)){
                files.push(file);
            }
        });
        return files;
    };


    // Take all the images from src, convert them, and write them to dst
    qt.convert = function(options, callback){
        var src = options.src,
            dst = options.dst,
            width = options.width,
            height = options.height,
            overwrite = options.overwrite || false,
            limit = options.limit || 1;

        var images = qt.findImages(src),
            converted = [];

        mkdirp(dst);

        function convert(file, callback){
            var filename = path.basename(file),
                fpath = path.join(dst, filename);

            function _success(){
                converted.push(fpath);
                callback(null);
            }

            function _convert(){
                var ei_options = {
                    src : file,
                    dst : fpath,
                    width : width,
                    height : height
                };
                ei.rescrop(ei_options, function(err, image){
                    if (err){
                        return callback(err);
                    }
                    console.log('Resized:', image);
                    _success();
                });
            }

            if (overwrite){
                return _convert();
            }

            fs.exists(fpath, function(exists){
                if (exists){
                    console.log('USING CACHE', fpath);
                    _success();
                }
                else{
                    _convert();
                }
            });
        }

        async.forEachLimit(images, limit, convert, function(err){
            callback(err, converted);
        });
    };


    qt.express = function(uri, root){
        root = path.normalize(root);
        console.log('ROOT', root);

        var regex_match = new RegExp('^' + uri);

        return function (req, res, next){
            var url = req.url.replace(/\?.*/,''),
                file = url.replace(regex_match, ''),
                dim = req.query.dim,
                fpath = path.normalize(root + file);

            if (!regex_match.test(url)){
                return next();
            }

            console.log('fpath', fpath);
            console.log('file', file);

            fs.exists(fpath, function(exists){
                console.log("exists", exists);
                if (!exists){
                    return next();
                }
                else if (exists && !dim){
                    return res.sendfile(fpath);
                }
                var dims = dim.split(/x/g),
                    dst = path.join(root, '.cache', dim, path.dirname(file)),
                    dpath = path.join(dst, path.basename(file)),
                    options = {
                        src : fpath,
                        dst : dst,
                        width : dims[0] || undefined,
                        height : dims[1] || undefined,
                    };

                console.log(options);
                console.log("dpath", dpath);
                qt.convert(options, function(err, images){
                    if (err){
                        console.error("ERROR", err);
                        next();
                    }
                    res.sendfile(images[0]);
                });
            });
        };
    };

})();
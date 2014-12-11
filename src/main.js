(function(Polymer) {
    'use strict';

    var tagValue = function(size) {
        var tags = ['B', 'KB', 'MB', 'GB', 'TB'], unit = 'TB', i;
        for (i = 0; i < tags.length; i++) {
            if (size >= 1024) {
                size = size / 1024;
            }
            else {
                unit = tags[i];
                break;
            }
        }
        return {size: size.toFixed(2), unit: unit};
    };

    Polymer('cloud-storage', {
        // Fires when an instance of the element is created
        created: function() {},

        // Fires when the "<polymer-element>" has been fully prepared
        ready: function() {},

        // Fires when the element’s initial set of children and siblings are guaranteed to exist
        domReady: function() {
            var FILE_SIZE_LIMIT = 10 * 1024 * 1024 * 1024;

            var box = $(this.$.box);
            var input = $(this.$.files);
            var ul = $(this.$.fileList);
            var shadowRoot = this.shadowRoot;

            var endpoint = this.endpoint;

            function ajaxFileUpload(file) {
                var formData = new FormData();
                formData.append('file', file, file.name);

                var progressBar = $(shadowRoot.querySelector('#progressbar_' + file.id));

                $(progressBar).progressbar({
                    value: false,
                    change: function() {
                        var label = $(progressBar).find('.progress-label');
                        var value = $(progressBar).progressbar('value');
                        if (value === false) {
                            label.text('Error');
                            $(progressBar).addClass('error');
                        } else {
                            label.text(Math.floor(value) + '%');
                        }
                    }
                });

                // It seems that the CloudScalers are responding with a 202 to the POST and even with a 200 to the
                // following HEAD requests, even if the file is really not available yet, so in order to guarantee that
                // the file is reachable we do a GET to the bucket requesting the object, and we repeat the operation
                // after a increasing period of time until the GET do really return the file information (at this
                // moment we are sure that the file is available)
                function verifyElementWasUploaded(timeWait) {
                    $.ajax({
                        url: endpoint + '?format=json&name=' + encodeURIComponent(file.name),
                        type: 'GET',
                        xhrFields: {
                            withCredentials: true
                        }
                    }).done(function (data, textStatus, jqXHR) {
                            var fileAvailable = data && data.length > 0;
                            if (!fileAvailable) {
                                setTimeout(function retry() {
                                    verifyElementWasUploaded(timeWait * 2);
                                }, timeWait * 2);
                            } else {
                                fileUploaded(file);
                            }
                        }).fail(function headFail(jqXHR, textStatus) {
                            fileUploaded(file);
                        });
                }

                $.ajax({
                    url: endpoint,
                    type: 'POST',
                    data: formData,
                    // Options to tell JQuery not to process data nor worry about content-type
                    cache: false,
                    contentType: false,
                    processData: false,
                    xhrFields: {
                        withCredentials: true
                    },
                    xhr: function() {
                        var myXhr = $.ajaxSettings.xhr();
                        if (myXhr.upload) {
                            myXhr.upload.addEventListener('progress', function(e) {
                                if (e.lengthComputable) {
                                    var percentComplete = e.loaded / e.total;
                                    $(progressBar).progressbar('value', 99 * percentComplete);
                                }
                            }, false);
                        }
                        return myXhr;
                    }
                }).done(function uploadSuccess(data, textStatus, jqXHR) {
                        verifyElementWasUploaded(500);
                    }).fail(function uploadFail(jqXHR, textStatus) {
                        if (jqXHR.status === 0) {
                            // Make a HEAD request to check if the object was uploaded and the error is just due to a cross domain issue.
                            $.ajax({
                                url: endpoint + '/' + file.name,
                                type: 'HEAD',
                                xhrFields: {
                                    withCredentials: true
                                }
                            }).done(function headSuccess(data, textStatus, jqXHR) {
                                    fileUploaded(file);
                                }).fail(function headFail(jqXHR, textStatus) {
                                    errorUploading(file);
                                });
                        } else {
                            errorUploading(file);
                        }
                    });
            }

            function generateFileRow(file) {
                var size = tagValue(file.size);
                var source = $(shadowRoot.querySelector('#file-template')).text();
                var template = Handlebars.compile(source);

                var context = {
                    size: size, // TODO not needed, register handlebars helper
                    file: file
                };
                return template(context);
            }

            function fileUploaded(file) {
                var progressBar = $(shadowRoot.querySelector('#progressbar_' + file.id));
                $(progressBar).progressbar('value', 100);
            }

            function errorUploading(file, errorMessage) {
                var progressBar = $(shadowRoot.querySelector('#progressbar_' + file.id));
                $(progressBar).progressbar('value', false);
            }

            function processFiles(files) {
                for (var i = 0, file; file = files[i]; i++) {
                    file.id = 'file' + parseInt(Math.random() * 10000000);

                    $('.name').each(function overwriteFilesByName() {
                        if ($(this).children('span').text() === file.name) {
                            $(this).parents('.rowItem').remove();
                        }
                    });

                    ul.append(generateFileRow(file));

                    if (file.size >= FILE_SIZE_LIMIT) {
                        errorUploading(file, 'File is too big');
                    } else {
                        ajaxFileUpload(file);
                    }
                }
            }

            input.change(function onFileChoosen() {
                processFiles(input[0].files);
            });

            $(box).on('dragover', function(e) {
                e.preventDefault();
                e.stopPropagation();
            });
            $(box).on('dragenter', function(e) {
                e.preventDefault();
                e.stopPropagation();
            });

            $(box).on('drop', function(e) {
                if(e.originalEvent.dataTransfer){
                    if(e.originalEvent.dataTransfer.files.length) {
                        e.preventDefault();
                        e.stopPropagation();
                        processFiles(e.originalEvent.dataTransfer.files);
                    }
                }
            });



        },

        // Fires when the element was inserted into the document
        attached: function() {},

        // Fires when the element was removed from the document
        detached: function() {},

        // Fires when an attribute was added, removed, or updated
        attributeChanged: function(attr, oldVal, newVal) {}
    });

})(window.Polymer);

(function(Polymer) {
    'use strict';

    Polymer('cloud-storage', {
        // Fires when an instance of the element is created
        created: function() {},

        // Fires when the "<polymer-element>" has been fully prepared
        ready: function() {},

        // Fires when the element’s initial set of children and siblings are guaranteed to exist
        domReady: function() {
            var fileSizeLimit = 10 * 1024 * 1024 * 1024;
            var input = $(this.$.files);
            var ul = $(this.$.fileList);
            var shadowRoot = this.shadowRoot || this;
            input.change(function() {
                var tagValue = function(num) {
                    var tags = ['B', 'KB', 'MB', 'GB', 'TB'], unit = 'TB', i;
                    for (i = 0; i < tags.length; i++) {
                        if (num >= 1024) {
                            num = num / 1024;
                        }
                        else {
                            num = Number(num);  // Just in case num is a string...
                            unit = tags[i];
                            break;
                        }
                    }
                    return {num: num, unit: unit};
                };

                function generateFileRow(name, fileId, fileSize) {
                    var size = tagValue(fileSize);

                    var newFile = '<li class="rowItem">' +
                    '<div class="rowItemWrap">' +
                    '<div id="name_' + fileId + '" class="name" title="' + escape(name) + '">' +
                    '<span>' + name + '</span></div>' +
                    '<div class="options progress"><div id="progressbar_' + fileId + '" class="field_content">' +
                    '<div class="progress-label"></div></div></div>' +
                    '<div class="size"><span>' + size.num.toFixed(2) + ' ' + size.unit + '</span></div>' +
                    '</div></li>';

                    return newFile;
                }

                function fileUploaded(name, fileId) {   // file uploading completed
                    var progressBar = $(shadowRoot.querySelector('#progressbar_' + fileId));
                    $(progressBar).progressbar('value', 100);
                }

                function errorUploading(fileId, message) {
                    var progressBar = $(shadowRoot.querySelector('#progressbar_' + fileId));
                    $(progressBar).progressbar('value', -1);
                }

                function ajaxFileUpload(file, name, fileId) {
                    var formData = new FormData();
                    formData.append('file', file, name);

                    var progressBar = $(shadowRoot.querySelector('#progressbar_' + fileId));

                    // jQuery-ui progressbar
                    $(progressBar).progressbar({
                        value: false,
                        change: function() {
                            var label = $(progressBar).find('.progress-label');
                            var value = parseInt($(progressBar).progressbar('value'));
                            if (value === -1) {
                                label.text('Error uploading');
                            } else {
                                label.text(value + '%');
                            }
                        }
                    });

                    // It seems that the CloudScalers are responding with a 202 to the POST and even with a 200 to the
                    //  following HEAD requests, even if the file is really not available yet, so in order to guarantee that
                    //  the file is reachable we do a GET to the bucket requesting the object, and we repeat the operation
                    //  after a increasing period of time until the GET do really return the file information (at this
                    //  moment we are sure that the file is available)
                    function verifyElementWasUploaded(timeWait) {
                        $.ajax({
                            url: 'https://amruser.nos-eu-mad-1.instantservers.telefonica.com/bucket4?format=json&name=' + encodeURIComponent(name),
                            type: 'GET',
                            xhrFields: {
                                withCredentials: true
                            }
                        }).done(function (data, textStatus, jqXHR) {
                            if (!data || data.length === 0) {   // file is not available yet
                                setTimeout(function() {
                                    verifyElementWasUploaded(timeWait * 2); // wait a doubled period of time
                                }, timeWait * 2);
                            } else {
                                fileUploaded(name, fileId);
                            }
                        }).fail(function headFail(jqXHR, textStatus) {
                            fileUploaded(name, fileId);
                        });
                    }

                    $.ajax({
                        url: 'https://amruser.nos-eu-mad-1.instantservers.telefonica.com/bucket4',
                        type: 'POST',
                        data: formData,
                        //Options to tell JQuery not to process data or worry about content-type
                        cache: false,
                        contentType: false,
                        processData: false,
                        xhrFields: {
                            withCredentials: true
                        },
                        xhr: function() {
                            var myXhr = $.ajaxSettings.xhr();
                            if (myXhr.upload) { // if upload property exists
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
                        if (jqXHR.status === 0) {   // Make a HEAD request to check if the object was uploaded and the error is just due to cross domain...
                            $.ajax({
                                url: 'https://amruser.nos-eu-mad-1.instantservers.telefonica.com/bucket4/' + name,
                                type: 'HEAD',
                                xhrFields: {
                                    withCredentials: true
                                }
                            }).done(function headSuccess(data, textStatus, jqXHR) {
                                fileUploaded(name, fileId);
                            }).fail(function headFail(jqXHR, textStatus) {
                                errorUploading(fileId);
                            });
                        } else {
                            errorUploading(fileId);
                        }
                    });
                }

                for (var i = 0, file; file = input[0].files[i]; i++) {   // a request per file, to control the individual uploading
                    var name = (input[0].files.length === 1) ? $('#objectName').val() || file.name : file.name;
                    name = name.replace(/</g, "&lt;").replace(/>/g, "&gt;"); // bug IS-207: avoid HTML injection
                    var fileId = 'id_' + Math.floor(Math.random() * 1000000);

                    $('.name').each(function() {
                        if ($(this).children('span').text() === name) {
                            $(this).parents('.rowItem').remove();  // remove existing row with the same file name, as it will be overwritten
                        }
                    });

                    ul.append(generateFileRow(name, fileId, file.size));

                    if (file.size >= fileSizeLimit) {
                        errorUploading(fileId, 'File is too big');
                    } else {
                        ajaxFileUpload(file, name, fileId);
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

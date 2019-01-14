(function(){
    const host = location.host;
    const href = location.href;
    if(host === "hexe.net") {
        location.href = href.replace(host, "ura.hexe.net");
    }else if(host === "ura.hexe.net") {
        location.href = href.replace(host, "hexe.net");
    }else{
        location.href = "http://hexe.net/";
    }
})();

// use https://mrcoles.com/bookmarklet/ to make bookmarklet.

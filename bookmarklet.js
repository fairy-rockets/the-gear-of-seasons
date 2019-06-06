(function(){
    const host = location.host;
    const href = location.href;
    if(host === 'hexe.net') {
        location.href = href.replace('https://hexe.net/', 'https://ura.hexe.net/');
    }else if(host === 'ura.hexe.net') {
        location.href = href.replace('https://ura.hexe.net/', "https://hexe.net/");
    }else{
        location.href = "https://hexe.net/";
    }
})();

// use https://mrcoles.com/bookmarklet/ to make bookmarklet.

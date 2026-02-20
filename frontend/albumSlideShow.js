 
INTERVALS = [];
// const ALBUMS_URL = 'https://9m0eizfep4.execute-api.us-east-1.amazonaws.com/Dev/albums' ; 
//const PHOTOS_URL =  'https://9m0eizfep4.execute-api.us-east-1.amazonaws.com/Dev/photos-from-album/' ; 
const ALBUMS_URL = 'https://kgztccthjk.execute-api.us-east-1.amazonaws.com/prod/albums';
const PHOTOS_URL = 'https://kgztccthjk.execute-api.us-east-1.amazonaws.com/prod/albums/';

const photoAlbums = async () => {
    const response = await fetch(ALBUMS_URL);
    const albums = await response.json();
    return albums;
}



const loadAlbumSelector = async (selector) => {
  headerMessage.innerText = 'Getting Albums' ; 
    albums = await photoAlbums() ; 
    if (albums.length) {
      headerMessage.innerText = ""; 
      albums.unshift('Pick or Stop') ; 
      selectAlbum = document.getElementById(selector);
      for (a of albums) {
        let option = document.createElement('option');
        option.value = a;
        option.text = a;
        selectAlbum.appendChild(option);
      }
      selectAlbum.addEventListener('change', selectAlbumEventHandler, true);
    } 
    else {
      headerMessage.innerText = 'No albums returned';
    }   
} 

const selectAlbumEventHandler = async (event) => {
  headerMessage = document.getElementById('headerMessage');
  if (INTERVALS.length > 0) {
    for (i of INTERVALS) {
      window.clearInterval(i);
    }
  }
  albumName = event.srcElement.value  ;
  if (albumName == 'Pick or Stop') {
    headerMessage.innerText = '' ; 
    return  ; 
  }

  headerMessage.innerText = 'Getting Pics in ' + albumName  ;  
  const response = await fetch(PHOTOS_URL + albumName);  
  const photos = await response.json();
  doSlideShow(photos);
  return ; 
}
  
  
const doSlideShow = (photos) => { 
    const slideshow = document.getElementById('slide'); 
    slideshow.src = photos.shift() ;
    headerMessage = document.getElementById('headerMessage');
    headerMessage.innerText = '' ;  

    const interval = setInterval(function () {
      singleSlide = photos.shift();
      if(singleSlide) {
        slideshow.src = singleSlide;
      }
      else {
        window.clearInterval(interval);
      }
    }, 3000);
    INTERVALS.push(interval);
    return ; 
}


document.addEventListener('DOMContentLoaded', function() {
  loadAlbumSelector('selectAlbum');
});
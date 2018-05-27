class Model3d{
  constructor(faces, pts, color, pos){
    this.faces = faces;
    this.pts = pts;
    this.pos = pos;
    this.color = color;
  }
}

class Render3d{
  constructor(width, height, fov){
    this.xoffset = width/2
    this.yoffset = height/2
    this.width = width;
    this.height = height;
    var distance = this.xoffset / (Math.atan(fov*(Math.PI/180)));
    this.camera_p = {x: 0, y: -1, z: 0}
    this.camera_a = {x: 0, y: 0, z: 0}
    this.view_p = {x: 0, y: 0, z: distance}
    this.zbuffer = [];
  }
    
  //calculate the perspective 3d coordinates of the point defined by ax, ay, and az and the 2d coordinates of that point on the screen
  project(ax, ay, az, angles){
    var x = ax - this.camera_p.x;
    var y = ay - this.camera_p.y;
    var z = az - this.camera_p.z;
    
    var dx = angles.cy*(angles.sz*y + angles.cz*x) - angles.sy*z;
    var dy = angles.sx*(angles.cy*z + angles.sy*(angles.sz*y + angles.cz*x)) + angles.cx*(angles.cz*y - angles.sz*x);
    var dz = angles.cx*(angles.cy*z + angles.sy*(angles.sz*y + angles.cz*x)) - angles.sx*(angles.cz*y - angles.sz*x);
    return {x: (this.view_p.z*dx)/dz - this.view_p.x, y: (this.view_p.z*dy)/dz - this.view_p.y, dx:dx, dy:dy, dz:dz};
  }

  //get the x and y coordinates where z = the near clip distance
  clipCoords(t1, t2, clip){
    var t = (clip - t2.dz) / (t1.dz - t2.dz);
    var t1t = {};
    t1t.dx = t*(t1.dx - t2.dx) + t2.dx;
    t1t.dy = t*(t1.dy - t2.dy) + t2.dy;
    t1t.dz = clip;
    t1t.x = (this.view_p.z*t1t.dx)/t1t.dz - this.view_p.x;
    t1t.y = (this.view_p.z*t1t.dy)/t1t.dz - this.view_p.y;
    return t1t;
  }

  //transform world coordinates to camera coordinates and clip them to be in front of the camera
  transformPts(p1, p2, p3, obj_p, angles){
    var clip = 0.1;
    var t1 = this.project(p1[0]+obj_p.x, p1[1]+obj_p.y, p1[2]+obj_p.z, angles);
    var t2 = this.project(p2[0]+obj_p.x, p2[1]+obj_p.y, p2[2]+obj_p.z, angles);
    var t3 = this.project(p3[0]+obj_p.x, p3[1]+obj_p.y, p3[2]+obj_p.z, angles);
    if(t1.dz < clip && t2.dz < clip && t3.dz < clip){
      return [];
    } else if(t1.dz < clip && t2.dz < clip && t3.dz >= clip){
      var t1t = this.clipCoords(t1, t3, clip);
      var t2t = this.clipCoords(t2, t3, clip);
      return [t1t, t2t, t3];
    } else if(t1.dz < clip && t2.dz >= clip && t3.dz < clip){
      var t1t = this.clipCoords(t1, t2, clip);
      var t3t = this.clipCoords(t2, t3, clip);
      return [t1t, t2, t3t];
    } else if(t1.dz >= clip && t2.dz < clip && t3.dz < clip){
      var t2t = this.clipCoords(t1, t2, clip);
      var t3t = this.clipCoords(t1, t3, clip);
      return [t1, t2t, t3t];
    } else if(t1.dz < clip && t2.dz >= clip && t3.dz >= clip){
      var t1t = this.clipCoords(t1, t2, clip);
      var t3t = this.clipCoords(t1, t3, clip);
      return [t1t, t2, t3, t3t];
    } else if(t1.dz >= clip && t2.dz >= clip && t3.dz < clip){
      var t3t = this.clipCoords(t2, t3, clip);
      var t1t = this.clipCoords(t1, t3, clip);
      return [t1, t2, t3t, t1t];
    } else if(t1.dz >= clip && t2.dz < clip && t3.dz >= clip){
      var t2t = this.clipCoords(t1, t2, clip);
      var t3t = this.clipCoords(t2, t3, clip);
      return [t1, t2t, t3t, t3];
    } else{
      return [t1, t2, t3];
    }
  }

  //calculate the normal of the plane defined by p1, p2 and p3
  normal(p1, p2, p3){
    var qr = {x: p1.dx  - p2.dx, y: p1.dy - p2.dy, z: p1.dz - p2.dz}
    var qs = {x: p3.dx  - p2.dx, y: p3.dy - p2.dy, z: p3.dz - p2.dz}
    return {x: qr.y*qs.z - qr.z*qs.y, y: qr.z*qs.x - qr.x*qs.z, z: qr.x*qs.y - qr.y*qs.x}
  }

  //calculate the point of intersection of the plane defined by p1, p2 and p3 and the vector defined by x, y, and z
  intersect(p1, p2, p3, x, y, z){
    var norm = this.normal(p1, p2, p3)
    var t = (norm.x*p1.dx + norm.y*p1.dy + norm.z*p1.dz) / (norm.x*x + norm.y*y + norm.z*z)
    return {x: x*t, y: y*t, z: z*t}
  }

  //is the point x,y in the triangle defined by x1,y1 x2,y2 x3,y3
  isInTriangle(x1, y1, x2, y2, x3, y3, x, y){
    var l1 = ((y2-y3)*(x-x3)+(x3-x2)*(y-y3)) / ((y2-y3)*(x1-x3)+(x3-x2)*(y1-y3));
    var l2 = ((y3-y1)*(x-x3)+(x1-x3)*(y-y3)) / ((y2-y3)*(x1-x3)+(x3-x2)*(y1-y3));
    var l3 = 1 - l1 - l2;
    return (l1 >= 0 && l1 <= 1 && l2 >= 0 && l2 <= 1 && l3 >= 0 && l3 <= 1);
  }

  draw(buf, obj){
    var angles = {cy: Math.cos(this.camera_a.y), sy: Math.sin(this.camera_a.y), cx: Math.cos(this.camera_a.x), sx: Math.sin(this.camera_a.x), cz: Math.cos(this.camera_a.z), sz: Math.sin(this.camera_a.z)};
    var minx = this.width;
    var maxx = 0;
    var miny = this.height;
    var maxy = 0;
    
    for(var f in obj.faces){
      var face = obj.faces[f];
      var tpts = this.transformPts(obj.pts[face[0]], obj.pts[face[1]], obj.pts[face[2]], obj.pos, angles);
      if(tpts.length == 0){
        continue;
      }

      minx = this.width;
      maxx = 0;
      miny = this.height;
      maxy = 0;
      for (p in tpts){
        minx = Math.min(tpts[p].x+this.xoffset, minx);
        maxx = Math.max(tpts[p].x+this.xoffset, maxx);
        miny = Math.min(tpts[p].y+this.yoffset, miny);
        maxy = Math.max(tpts[p].y+this.yoffset, maxy); 
      }
      minx = Math.floor(Math.max(minx, 0));
      maxx = Math.ceil(Math.min(maxx, this.width));
      miny = Math.floor(Math.max(miny, 0));
      maxy = Math.ceil(Math.min(maxy, this.height));
      var facewidth = maxx - minx;
      var faceheight = maxy - miny;
      if(facewidth <= 1 || faceheight <= 1){
        continue;
      }
      
      var stop = true;
      for(var p in tpts){
        var zi = Math.floor(tpts[p].x + this.xoffset) + (this.width * Math.floor(tpts[p].y + this.yoffset));
        if(zi > this.width*this.heigth || zi < 0 || typeof this.zbuffer[zi] === 'undefined' || this.zbuffer[zi] > tpts[p].dz - 1){
          stop = false;
          break;
        }
      }
      if(stop){
        continue;
      }

      var ambient = 35;
      var minshade = 0.2;
      var brightness = 0.5;
      var norm = this.normal(tpts[0], tpts[1], tpts[2]);
      var len = Math.sqrt(norm.x * norm.x + norm.y * norm.y + norm.z * norm.z);
      var shade = Math.max(Math.min(Math.abs(norm.z) / len, 1), minshade) * brightness; //calculate amount to darken color

      var red = (obj.color.r * shade) + (obj.color.r * ambient/255);
      var green = (obj.color.g * shade) + (obj.color.g * ambient/255);
      var blue = (obj.color.b * shade) + (obj.color.b * ambient/255);

      for(var i = 0; i < facewidth*faceheight; i++){
        var screenI = this.width*(miny+Math.floor(i/facewidth)) + minx + (i%facewidth); //calculate the screen buffer index from the smaller temp buffer index
        var x = screenI%this.width-this.xoffset;
        var y = (screenI/this.width)-this.yoffset;
        if(this.isInTriangle(tpts[0].x, tpts[0].y, tpts[1].x, tpts[1].y, tpts[2].x, tpts[2].y, x, y) ||
        (tpts.length > 3 && this.isInTriangle(tpts[0].x, tpts[0].y, tpts[3].x, tpts[3].y, tpts[2].x, tpts[2].y, x, y))){
          var depth = this.intersect(tpts[0], tpts[1], tpts[2], x, y, this.view_p.z); //get the depth of the current pixel
          if(typeof this.zbuffer[screenI] === 'undefined' || this.zbuffer[screenI] > depth.z){ //only copy to the screen buffer if it is not occluded
            if(depth.z > 0.5){ //near clip
              var dist = Math.sqrt(Math.pow(depth.x,2) + Math.pow(depth.x,2) + Math.pow(depth.z,2));
              this.zbuffer[screenI] = depth.z;
              buf[screenI*4] = red - dist*2;
              buf[screenI*4+1] = green - dist*2;
              buf[screenI*4+2] = blue - dist*2;
              buf[screenI*4+3] = 255;
            }
          }
        }
      }
    }
    return buf;
  }
}

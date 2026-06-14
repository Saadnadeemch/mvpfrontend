import { Component } from '@angular/core';
import { Footer } from "../../components/footer/footer";
import { NavbarComponent } from "../../components/navbar/navbar";

@Component({
  selector: 'app-privacy',
  imports: [Footer, NavbarComponent],
  templateUrl: './privacy.html',
  styleUrl: './privacy.css',
})
export class Privacy {

}

import { UserService } from './services/user-service.js';

export class App {
  constructor(private readonly userService: UserService) {}

  run(): void {
    this.userService.findAll();
  }
}

export function bootstrap(): App {
  return new App(new UserService());
}

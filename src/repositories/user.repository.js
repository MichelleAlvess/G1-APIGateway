export class InMemoryUserRepository {
  constructor(demoUser) {
    this.users = [
      {
        id: demoUser.id,
        name: demoUser.name,
        email: demoUser.email.toLowerCase(),
        role: demoUser.role,
        passwordHash: demoUser.passwordHash,
        active: true
      }
    ];
  }

  async findByEmail(email) {
    const normalizedEmail = email.trim().toLowerCase();
    return this.users.find((user) => user.email === normalizedEmail) ?? null;
  }
}

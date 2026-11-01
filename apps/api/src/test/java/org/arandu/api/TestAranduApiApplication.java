package org.arandu.api;

import org.springframework.boot.SpringApplication;

public class TestAranduApiApplication {

	public static void main(String[] args) {
		SpringApplication.from(AranduApiApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
